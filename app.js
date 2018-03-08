const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en'
});

const TeamFortress2 = require('tf2');

const tf2 = new TeamFortress2(client);
const fs = require('fs');
const colors = require('colors');
const colours = require('colors/safe');
const currencies = require('./Currencies.json')
const config = require('./config');

var arrayOfObjects = [];
var busy = false;

const readAndWrite = require('./readAndWrite.js');
const ReadAndWrite = new readAndWrite();
const logOnOptions = {
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.shared_secret)
};

client.logOn(logOnOptions);

tf2.on("backpackLoaded", function() {
    tf2.sortBackpack(4);
    console.log("Backpack TF2 loaded and re-organized by type.");
});

client.on('loggedOn', () => {
    client.setPersona(SteamUser.Steam.EPersonaState.LookingToTrade, config.botName);
    client.gamesPlayed(440);
    console.log(colours.bgGreen(config.botName) + ' is online and looking for trade.'.green);

});
client.on('webSession', (sessionid, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
});

client.on('friendRelationship', function(steamID, relationship) {
    if (relationship == 2) {
        client.addFriend(steamID); //This only works for friend invites that are received when bots is online.
        console.log('A friend has been accepted.'.underline.green);
    }
});
manager.on('newOffer', (offer) => {
    if (busy) {
        arrayOfObjects.push(offer);
        console.log(`Pushing offer #${offer.id}`);
    } else {
        processTradeOffer(offer);
    }
});

//setInterval to parse incomming offers that were added to a queue.
setInterval(function() {

    if (arrayOfObjects.length > 0 && !busy) {

        processTradeOffer(arrayOfObjects[0]);
    }
}, 10000);

const processTradeOffer = function(offer) {
    busy = true;
    return getUserDetalles(offer)
        .then(function(escrowDays) {
            return identyOffer(offer, escrowDays);
        }).then(function(offerState) {
            return finishTradeOffer(offer, offerState);
        }).then(function() {
            if (arrayOfObjects.length > 0) {
                arrayOfObjects.splice(0, 1);
            }
            busy = false;
        }).catch(function() {
            busy = false;
            arrayOfObjects.push(offer);
        })
}

const identyOffer = function(offer, escrowDays) {
    return new Promise(function(resolve, reject) {
        var offerState = 'undefined';
        if (offer.isGlitched() || offer.state === 11 || escrowDays > 0) {
            offerState = 'denegable';
            return resolve(offerState);
        } else if (offer.partner.getSteamID64() === config.id_bossAccount) {
            offerState = 'aceptable';
            return resolve(offerState);
        } else if (offer.itemsToGive.length < 1) {
            offerState = 'aceptable';
            console.log('Donation =)');
            return resolve(offerState);

        } else {
            offerState = 'valida';
            return resolve(offerState);
        }
    })
}
const finishTradeOffer = function(offer, offerState) {
    switch (offerState) {
        case 'aceptable':
            return acceptTradeOffer(offer);
        case 'denegable':
            return declineTradeOffer(offer);
        case 'valida':
            return identifyItems(offer).then(function(offerState) {
                return finishTradeOffer(offer, offerState);
            });
        default:
            return Promise.reject();
    }

}
const identifyItems = function(offer) {
    var getValueToGive = getValueItemsToGive(offer);
    var getValueToReceive = getValueItemsToReceive(offer);
    return Promise.all([getValueToGive, getValueToReceive])
        .then((results) => {
            return determinateOfferState(results[0], results[1]);
        }).catch(err => {
            if (arrayOfObjects.length > 0) {
                arrayOfObjects.splice(0, 1)
            }
            busy = false;
        })
}
const getUserDetalles = function(offer) {
    return new Promise(function(resolve, reject) {
        offer.getUserDetails(function(err, me, them) {
            if (them) {
                return resolve(them.escrowDays);
            } else {
                return reject();
            }
        })
    })
}
const determinateOfferState = function(valueToGive, valueToReceive) {
    var ToGive = getRight(valueToGive);
    var ToReceive = getRight(valueToReceive);

    if (ToReceive >= ToGive) {
        console.log('Items to Give have a value of :'.bgRed + ToGive);
        console.log('Items to Receive have a value of :'.bgGreen + ToReceive);
        offerState = 'aceptable';
        return Promise.resolve(offerState);
    } else {
        console.log('Items to Give have a value of :'.bgRed + ToGive);
        console.log('Items to Receive have a value of :'.bgGreen + ToReceive);
        offerState = 'denegable';
        return Promise.resolve(offerState);
    }
}
const getValueItemsToGive = function(offer) {
    return new Promise(function(resolve, reject) {
        var filename = './DBPrices.json';
        var type = 'utf8';
        ReadAndWrite.readDataBase(filename, type)
            .then(function(database) {
                var promises = [];
                var arrItemsToGive = offer.itemsToGive;

                for (var i = 0; i < arrItemsToGive.length; i++) {

                    var buying = false;

                    promises.push(getValueOfEachItem(database, arrItemsToGive[i], buying));
                }
                Promise.all(promises)
                    .then((outgoingValue) => {
                        return sumValues(outgoingValue);
                    }).then(function(valueToGive) {
                        return resolve(valueToGive);
                    }).catch(err =>
                        console.log(err));
            })
    })

}
const getValueItemsToReceive = function(offer) {
    return new Promise(function(resolve, reject) {
        var filename = './DBPrices.json';
        var type = 'utf8';
        ReadAndWrite.readDataBase(filename, type)
            .then(function(database) {

                var arrItemsToReceive = offer.itemsToReceive;
                var promises = [];
                for (var i in arrItemsToReceive) {
                    var buying = true;

                    promises.push(getValueOfEachItem(database, arrItemsToReceive[i], buying))
                }
                Promise.all(promises)
                    .then((incomingValue) => {
                        return sumValues(incomingValue);
                    }).then(function(valueToReceive) {
                        return resolve(valueToReceive);
                    }).catch(err => console.log(err));
            })
    })

}
const getValueOfEachItem = function(database, object, buying) {

    return new Promise(function(resolve, reject) {

        setItemDetails(object)
            .then((item) => {
                if (!buying) {
                    if (currencies[item.name]) {
                        return resolve(currencies[item.name].value);
                    } else if (database[item.name]) {
                        if (database[item.name].craftable == item.craft) {
                            return resolve(database[item.name].sell);
                        } else {
                            console.log(item.name + item.craft);
                            return resolve(999999);
                        }
                    } else {
                        console.log(item.name + 'User is taking an unkown item from us');
                        return resolve(999999);
                    }
                } else {
                    if (item.appid != '440') {
                        console.log('User is giving us an item from other Steam Game');
                        return resolve(0);
                    } else {
                        if (currencies[item.name]) {
                            return resolve(currencies[item.name].value);
                        } else if (database[item.name]) {
                            if (database[item.name].craftable == item.craft) {

                                return resolve(database[item.name].buy)

                            } else {
                                console.log('Item name in DBPrices with no coincidence in craft');

                                console.log(item.name + item.craft);
                                return resolve(0);
                            }
                        } else {
                            console.log('User is giving us an unknown item. add to DBPrices');
                            console.log(item.name + item.craft);
                            return resolve(0);

                        }
                    }
                }
            })


    })
}

const setItemDetails = function(object) {
    return new Promise(function(resolve, reject) {
        var item ={};
        var desc = object.descriptions;
        item.appid = object.appid;
        item.name = object.market_hash_name;
        item.craft = 'Craftable';
        var found = desc.some(function(el) {
            return el.value === '( Not Usable in Crafting )'
        });
        if (found) {
            item.craft = 'Non-Craftable';
        }
        return resolve(item);


    })
}
const sumValues = function(arrNumbers) {
    return new Promise(function(resolve, reject) {
        if (arrNumbers.length > 0) {
            const sum = arrNumbers.reduce((total, amount) => total + amount);
            return resolve(sum);
        } else {
            return resolve(0);
        }
    })
}

function getRight(v) {

    var i = Math.floor(v),
        f = Math.round((v - i) / 0.11);
    return i + (f === 9 || f * 0.11);

}
const acceptTradeOffer = function(offer) {

    offer.accept(false, function(error, status) {
        if (error) {
            console.log(`\nError: Failed to accept the trade offer #${offer.id}\n`);
            console.log(error);
            return Promise.reject();

        } else if (status === 'pending') {
            console.log(`StatusMsg : The trade offer #${offer.id} is accepted but needs confirmation`);

            community.acceptConfirmationForObject(config.identity_secret, offer.id, function(error) {

                if (error) {} else {
                    console.log(`StatusMsg : The trade offer #${offer.id} is confirmed`.green);
                    return Promise.resolve();
                }
            });

        } else {
            console.log(`StatusMsg : The trade offer #${offer.id} is accepted`.green);
            return Promise.resolve();
        }
    });

}
const declineTradeOffer = function(offer) {

    offer.decline(function(error) {

        if (error) {
            console.log(`\nError: Failed to decline the trade offer #${offer.id}\n`);
            console.log(error);
            declineTradeOffer(offer);
        } else {
            console.log(`StatusMsg : The trade offer #${offer.id} is declined`.red);
            return Promise.resolve();
        }


    })
}
