const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const TeamFortress2 = require('tf2');
const Utils = require('./utils')
const Items = require('./item')
const logger = require('./logger')
const config = require('./config')
const PQueue = require('p-queue');
const client = new SteamUser();
const tf2 = new TeamFortress2(client);
const taskQueue = new PQueue({ concurrency: 1 });
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en',
    cancelTime: 600000,
});
const logOnOptions = {
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.shared_secret)
};

// APP START
client.logOn(logOnOptions);

client.on('loggedOn', () => {
    client.setPersona(SteamUser.Steam.EPersonaState.LookingToTrade, config.botName);
    client.gamesPlayed(440);
    logger.correct(`${config.botName} is online and looking for a trade`);
});

client.on('webSession', (sessionid, cookies) => {
    community.setCookies(cookies);
    manager.setCookies(cookies, (err) => {
        if (err) {
            logger.error(`| WEB COOKIES |: ERROR: ${err.toString()}`);
        } else {
            taskQueue.add(() => updateInve(client.steamID.getSteamID64())).then(() => {
                logger.correct(`| UPDATE INVENTORY |: ended succesfully! `)
            }).catch((err) => {
                logger.fail(`| UPDATE INVENTORY |: ERROR: ${err}`)
            });
            logger.correct(`| WEB COOKIES |: Ready for receive offer!`);
        }
    })
});


client.on('friendRelationship', function (steamID, relationship) {
    if (relationship == 2) {
        logger.correct(` | NEW NOTIFICATION |: Steam ID: ${steamID.getSteamID64()} has added us!`);
        client.addFriend(steamID, (err, name) => {
            if (err) {
                logger.error(`| NEW FRIEND |: Error trying to add ${steamID.getSteamID64()}. Reason: ${err.toString()} `);
            } else if (name) {
                logger.correct(` | NEW FRIEND |: Succesfully added ${name} to friendlist.`);
            }
        });
    } else if (relationship == 0) {
        logger.fail(`| NEW FRIEND |: USER ID: ${steamID.getSteamID64()} has deleted us from their friendlist.`);
    }
});

manager.on('newOffer', (offer) => {
    logger.info(`| NEW OFFER |: New offer has been arrived! ID${offer.id}`);
    taskQueue.add(() => processTradeOffer(offer)).then(() => {
        logger.correct(`| OFFER ANALYZED |: ID#${offer.id} has been processed! `)
    }).catch((error) => {
        logger.fail(`| OFFER ANALYZED |: ID#${offer.id} - ERROR: ${error}`)
    });
});
manager.on('receivedOfferChanged', offer => {
    let id = offer.manager.steamID.getSteamID64();
    switch (offer.state) {
        case 1:
        case 8: //INVALID
            logger.fail(` | OFFER INVALID |: ID#${offer.id}. Reason: Items are no longer availables.`);
            break;
        case 3: //ACCEPTED
            logger.correct(`| OFFER ACCEPTED |: ID#${offer.id}.`);
            taskQueue.add(() => updateInve(id)).then(() => {
                logger.correct(`| UPDATE INVENTORY |: ended succesfully! `)
            }).catch((err) => {
                logger.fail(`| UPDATE INVENTORY |: ERROR: ${err}`)
            });
            break;
        case 6: //CANCELED
            logger.fail(`| OFFER CANCELLED |: ID#${offer.id}. Reason: User has cancelled his trade offer.`);
            break;
        case 7: //DECLINED
            logger.correct(`| OFFER DECLINED |: ID#${offer.id}. Reason: Not enough value to receive.`);
            break;
        default:
            return;
    }
})
manager.on('sentOfferChanged', offer => {
    let id = offer.manager.steamID.getSteamID64();
    switch (offer.state) {
        case 1:
        case 8: //INVALID
            logger.fail(` | OFFER INVALID |: ID#${offer.id}. Reason: Items are no longer availables.`);
            break;
        case 3: //ACCEPTED
            logger.correct(`| OFFER ACCEPTED |: ID#${offer.id}.`);
            taskQueue.add(() => updateInve(id)).then(() => {
                logger.correct(`| UPDATE INVENTORY |: ended succesfully! `)
            }).catch((err) => {
                logger.fail(`| UPDATE INVENTORY |: ERROR: ${err}`)
            });
            break;
        case 6: //CANCELED
            logger.fail(`| OFFER CANCELLED |: ID#${offer.id}. Reason: Bot has cancelled his trade offer.`);
            break;
        case 7: //DECLINED
            logger.correct(`| OFFER DECLINED |: ID#${offer.id}. Reason: Not enough value to receive.`);
            break;
        default:
            return;
    }
})
const updateInve = (steamID) => {
    logger.info(`| UPDATE INVENTORY |: Has been started...`);
    return new Promise(async function (resolve, reject) {
        try {
            const inv = await updateInventory(steamID);
            const craft = await craftMetal();
            return resolve();
        }
        catch (err) {
            return reject(err);
        }
    });
}
const processTradeOffer = (offer) => {
    return new Promise(async function (resolve, reject) {
        try {
            const ban = await isBanned(offer.partner.getSteamID64());
            const escrowDays = await checkEscrowDays(offer, client);
            const offerState = await identifyOffer(offer, escrowDays, ban);
            const finish = await finishTradeOffer(offer, offerState, community);
            return resolve();
        } catch (err) {
            logger.error(`| OFFER RECEIVED | Bot has failed trying process offer ID#${offer.id}`);
            logger.error(err);
            return reject(err);
        }
    });
}
const isBanned = (steamID64) => {
    return new Promise(function (resolve, reject) {
        logger.info(`| CHECK USER REPUTATION | Checking if user #ID${steamID64} is scammer or alt account...`);
        return Utils.promiseRequest({ url: `https://api.tf2automatic.com/v1/users/alt?steamid=${steamID64}`, method: 'GET', gzip: true, json: true })
            .then((body) => {
                let banned = false;
                if (body.result.is_alt && body.result.reviewed_by_detective) {
                    banned = true;
                }
                return resolve(banned);
            }).catch((err) => {
                return reject(err);
            })
    })
}
const checkEscrowDays = (offer) => {
    return new Promise(function (resolve, reject) {
        offer.getUserDetails(function (err, me, them) {
            if (err) {
                if (err.toString().indexOf('Not Logged In') > -1) {
                    logger.error(`| SESSION EXPIRED | Session and cookies are expired. Need to re-log in..`);
                    client.webLogOn()
                }
                return reject(err)
            } else if (them) {
                var sum = them.escrowDays + me.escrowDays;
                return resolve(sum);
            }
        })
    })
}
const identifyOffer = (offer, escrowDays, isBanned) => {
    return new Promise((resolve, reject) => {
        if (offer.isGlitched() || offer.state === 11 || escrowDays !== 0) {
            return resolve('denegable');
        } else if (isBanned) {
            logger.fail(`| OFFER RECEIVED |: ID#${offer.partner.getSteamID64()} is banned from Backpack.tf. Declining...`);
            return resolve('denegable');
        } else if (offer.state === 1 || offer.state === 3 || offer.state === 6 || offer.state === 7 || offer.state === 8) {
            return resolve('deleteable');
        } else if (config.arr_idBossAccount.indexOf(offer.partner.getSteamID64()) > -1) {
            return resolve('aceptable');
        } else if (offer.itemsToGive.length < 1) {
            logger.info(`| DONATION |:  We have receive a Donation from User ID#${offer.partner}. Congrats!`);
            return resolve('aceptable');
        } else {
            return resolve('valida');
        }
    })
}
const finishTradeOffer = (offer, offerState) => {
    switch (offerState) {
        case 'aceptable':
            return acceptTradeOffer(offer, community);
        case 'denegable':
            return declineTradeOffer(offer);
        case 'deleteable':
        case 'done':
            return Promise.resolve();
        case 'valida':
            return identifyItems(offer).then((offerState) => {
                return finishTradeOffer(offer, offerState, community);
            });
        default:
            return Promise.reject();
    }
}
const identifyItems = (offer) => {
    return Utils.readJSON(`./Database.json`)
        .then((DBPrices) => {
            var getValueGive = getValueItemsToGive(DBPrices, offer.itemsToGive);
            var getValueReceive = getValueItemsToReceive(DBPrices, offer.itemsToReceive, offer.manager.steamID.getSteamID64());
            return Promise.all([getValueGive, getValueReceive])
                .then((results) => {
                    return determinateOfferState(results[0], results[1]);
                }).catch((err) => {
                    logger.error(`| OFFER RECEIVED |: Error: ${err}`);
                    return Promise.resolve('deleteable');
                })
        })
}
const getValueItemsToGive = (DBPrices, toGive) => {
    return new Promise((resolve, reject) => {
        var obj = { keys: 0, metal: 0 };
        for (var i = 0; i < toGive.length; i++) {
            let name = Items.correctName(toGive[i]);
            if (DBPrices[name]) {
                if (name == 'Mann Co. Supply Crate Key') {
                    obj.keys++;
                } else {
                    obj.keys += DBPrices[name].sell.keys;
                    obj.metal += DBPrices[name].sell.metal;
                }
            } else if (name == 'Refined Metal') {
                obj.metal += 1;
            } else if (name == 'Reclaimed Metal') {
                obj.metal += 0.33;
            } else if (name == 'Scrap Metal') {
                obj.metal += 0.11;
            } else if (Weapons.indexOf(Items.parseName(name)) !== -1) {
                obj.metal += 0.055;
            } else {
                logger.info(`| ITEMS TO GIVE |: User is taking us an non-listed item: ${name}. Declining..`);
                obj.keys += 999999;
            }
        }
        obj.metal = Utils.parseToRefined(obj.metal);
        if (DBPrices['Mann Co. Supply Crate Key']) {
            obj = Utils.parsePrice(obj, DBPrices['Mann Co. Supply Crate Key'].sell.metal);
        }
        return resolve(obj);
    })
}
const getValueItemsToReceive = (DBPrices, toReceive, steamID) => {
    return new Promise((resolve, reject) => {
        return Utils.readJSON(`./${steamID}Inventory.json`)
            .then(function (inventory) {
                var arr = [];
                for (var x in inventory) {
                    arr.push(inventory[x].name);
                }
                var obj = { keys: 0, metal: 0 };
                for (var i = 0; i < toReceive.length; i++) {
                    let name = Items.correctName(toReceive[i]);
                    let gifted = Items.isGifted(toReceive[i]);
                    if (toReceive[i].appid != 440) {
                        logger.info(`| ${config.bots[steamID].personaName} | ITEMS TO RECEIVE |: User is giving us an item that is not from TF2: ${name}.`);
                    } else {
                        if (DBPrices[name]) {
                            if (name == 'Mann Co. Supply Crate Key') {
                                obj.keys++;
                            } else {
                                if (gifted && !config.accept_gifted) {
                                    logger.info(`| ITEMS TO RECEIVE |: User is giving us a gifted item. Set true in config to accept them.`);
                                } else {
                                    let count = toReceive.filter(obj => obj.market_hash_name == toReceive[i].market_hash_name);
                                    let search = arr.filter(obj => obj == name);
                                    if (count.length + search.length <= DBPrices[name].max_stock) {
                                        obj.keys += DBPrices[name].buy.keys;
                                        obj.metal += DBPrices[name].buy.metal;
                                    } else {
                                        logger.info(`| ${config.bots[steamID].personaName} | ITEMS TO RECEIVE |: User is giving us an overstocked item. Bot already has ${search.length} of ${name}. Max_Stock is ${DBPrices[name].max_stock}`);
                                    }
                                }
                            }
                        } else if (name == 'Refined Metal') {
                            obj.metal += 1;
                        } else if (name == 'Reclaimed Metal') {
                            obj.metal += 0.33;
                        } else if (name == 'Scrap Metal') {
                            obj.metal += 0.11;
                        } else if (Weapons.indexOf(Items.parseName(name)) !== -1) {
                            obj.metal += 0.055;
                        } else {
                            logger.info(`| ITEMS TO RECEIVE |: User is giving us an unknown item: ${name}.`);
                        }
                    }
                }
                obj.metal = Utils.parseToRefined(obj.metal);
                if (DBPrices['Mann Co. Supply Crate Key']) {
                    obj = Utils.parsePrice(obj, DBPrices['Mann Co. Supply Crate Key'].sell.metal);
                }
                return resolve(obj);
            })
    })
}
const determinateOfferState = (valueToGive, valueToReceive) => {
    logger.correct(`| VALUE TO RECEIVE |: ${valueToReceive.keys} keys & ${valueToReceive.metal} refineds.`);
    logger.fail(`| VALUE TO GIVE |: ${valueToGive.keys} keys & ${valueToGive.metal} refineds.`);
    if (valueToReceive.keys > valueToGive.keys) {
        return Promise.resolve('aceptable');
    } else if (valueToReceive.keys == valueToGive.keys && valueToReceive.metal >= valueToGive.metal) {
        return Promise.resolve('aceptable');
    } else {
        return Promise.resolve('denegable');
    }
}
const acceptTradeOffer = (offer) => {
    offer.accept(false, function (error, status) {
        if (error) {
            logger.error(`| OFFER RECEIVED |: ID#${offer.id} has failed trying to accept it. Reason: ${error.toString()}`);
            return 'Badass';
        } else if (status === 'pending') {
            logger.info(`| OFFER NEEDS CONFIRM | : ID#${offer.id} is accepted but needs confirmation`);
            var confCount = 0;
            function confirm(idSecret, idOffer) {
                community.acceptConfirmationForObject(idSecret, idOffer, function (error) {
                    confCount++
                    if (error) {
                        if (confCount < 4) {
                            confirm(idSecret, idOffer);
                        } else {
                            logger.error(error);
                            logger.fail(`| OFFER RECEIVED | : ID#${offer.id} has failed trying to confirm it. Reason: Offer is no longer valid.`);
                            return 'done';
                        }
                    } else {
                        return 'done';
                    }
                });
            }
            confirm(config.identitySecret, offer.id);
        } else {
            return 'done';
        }
    });
}
const declineTradeOffer = (offer) => {
    offer.decline(function (error) {
        if (error) {
            logger.error(`| OFFER RECEIVED |: Error tying to decline trade offer.`)
            return 'Badass';
        } else {
            return Promise.resolve();
        }
    })
}

// MANAGE INVENTORY
const updateInventory = (steamID) => {
    return new Promise(async function (resolve, reject) {
        try {
            const botInv = await getSteamInventory(steamID);
            const parse = await parseSteamInventory(botInv, steamID);
            const write = await Utils.writeJSON(`./${steamID}Inventory.json`, parse);
            return resolve();
        } catch (err) {
            logger.error(`| BOT INVENTORY | ERROR: ${err}!`);
            return reject(err);
        }
    });
}
const getSteamInventory = (steamid) => {
    return new Promise(function (resolve, reject) {
        manager.getUserInventoryContents(steamid, 440, 2, true, function (err, inventory) {
            if (err) {
                return reject(err);
            } else {
                return resolve(inventory);
            }
        })
    })
}
const parseSteamInventory = (array, steamID) => {
    return new Promise((resolve, reject) => {
        return Utils.readJSON('./Database.json')
            .then((DBPrices) => {
                var inve = {};
                for (let i = 0; i < array.length; i++) {
                    let item_name = Items.correctName(array[i]);
                    if (DBPrices[item_name]) {
                        inve[array[i].assetid] = {
                            name: item_name,
                            owner: steamID,
                            assetid: array[i].assetid,
                            sellPrice: DBPrices[item_name].sell
                        }
                    }
                }
                return resolve(inve);
            })
    })
}
// CRAFT METAL - DELETE TRASH
const craftMetal = () => {
    return new Promise( (resolve, reject) => {
        if (tf2.backpack == undefined) {
            logger.info(`| TF2 BACKPACK | TF2 Game Server appears as offline and bot couldnt smelt/craft metal. Connecting..`);
            client.gamesPlayed(440);
            return resolve()
        } else {
            var reclaimeds = tf2.backpack.filter(obj => obj.defIndex == 5001);
            var refineds = tf2.backpack.filter(obj => obj.defIndex == 5002);
            var scraps = tf2.backpack.filter(obj => obj.defIndex == 5000);
            var cases = tf2.backpack.filter(obj => config.trash_defindex.indexOf(obj.defIndex) > -1);
            if (reclaimeds.length < config.min_Reclaimeds) {
                if (refineds.length > 0) {
                    tf2.craft([parseInt(refineds[0].id)]);
                }
            } else if (reclaimeds.length >= config.min_Reclaimeds+3) {
                for (var x = 2; x + 2 < reclaimeds.length; x += 3) {
                    var craftRecipe = [];
                    craftRecipe.push(parseInt(reclaimeds[x].id), parseInt(reclaimeds[x + 1].id), parseInt(reclaimeds[x + 2].id));
                    tf2.craft(craftRecipe);
                }
            }
            if (scraps.length < config.min_Scraps) {
                if (reclaimeds.length > 0) {
                    tf2.craft([parseInt(reclaimeds[0].id)]);
                }
            } else if (scraps.length >= config.min_Scraps+3) {
                for (var y = 2; y + 2 < scraps.length; y += 3) {
                    var craftRecipe = [];
                    craftRecipe.push(parseInt(scraps[y].id), parseInt(scraps[y + 1].id), parseInt(scraps[y + 2].id));
                    tf2.craft(craftRecipe);
                }
            }
            if (cases.length > 0) {
                for (let i = 0; i < cases.length; i++) {
                    tf2.deleteItem(parseInt(cases[i].id));
                }
            }
            tf2.sortBackpack(4);
            return resolve();
        }
    });

}
