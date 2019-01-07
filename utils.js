
const jsonfile = require('jsonfile')
const request = require('request-promise')

exports.isCraftWeapon = (item) => {
    if(item.appid != 440) return false;
    if(isGifted && !config.accept_gifted) return false;
    if (item.marketable) return false;
    if (!isUnique(item)) return false;
    const type = getTag('Type', item);
    if (!type) return false;
    if (item.market_hash_name.match(/(Class|Slot) Token/)) return false;
    if (!isCraftable(item)) return false;
    if (item.market_name.indexOf('Festivized ') != -1) return false;
    if (item.market_name.indexOf('Festive ') != -1) return false;
    if (isKillstreak(item) != 0) return false;

    const notCraftWeapons = ['The Hot Hand', 'C.A.P.P.E.R', 'Horseless Headless Horsemann\'s', 'Three-Rune Blade', 'Nostromo Napalmer', 'AWPer Hand', 'Quäckenbirdt', 'Sharp Dresser', 'Conscientious Objector', 'Frying Pan', 'Batsaber', 'Black Rose', 'Scattergun', 'Rocket Launcher', 'Sniper Rifle', 'Shotgun', 'Grenade Launcher', 'Shooting Star', 'Big Kill', 'Fishcake', 'Giger Counter', 'Maul', 'Unarmed Combat', 'Crossing Guard', 'Wanga Prick', 'Freedom Staff', 'Ham Shank', 'Ap-Sap', 'Pistol', 'Bat', 'Flame Thrower', 'Construction PDA', 'Fire Axe', 'Stickybomb Launcher', 'Minigun', 'Medi Gun', 'SMG', 'Knife', 'Invis Watch', 'Sapper', 'Mutated Milk', 'Bread Bite', 'Snack Attack', 'Self - Aware Beauty Mark', 'Shovel', 'Bottle', 'Wrench', 'Bonesaw', 'Kukri', 'Fists', 'Syringe Gun', 'Revolver', 'Shotgun', 'SMG', 'Sapper', 'Grenade Launcher', 'Bonesaw', 'Revolver'];

    for (let i = 0; i < notCraftWeapons.length; i++) {
        const name = notCraftWeapons[i];
        if (item.market_name.indexOf(name) != -1) return false;
    }
    return ['Primary weapon', 'Secondary weapon', 'Melee weapon', 'Primary PDA', 'Secondary PDA'].indexOf(type) != -1;
}

function isGifted (item) {
    var gifted = false;
    var find = item.descriptions.some(function(el) {
        return el.value.indexOf('Gift from') !== -1
    });
    if (find) {
        gifted = true;
    }
    return gifted;
  }

function getQuality (item) {
    return getTag('Quality', item);
}

function isUnique (item) {
    return getQuality(item) == 'Unique';
}

function isCraftable (item) {
    return !hasDescription('( Not Usable in Crafting )', item);
}
function getTag (category, item) {
    const tags = item.tags;
    if (!tags) {
        return null;
    }

    for (let i = 0; i < tags.length; i++) {
        if (tags[i].category == category || tags[i].category_name == category) {
            return tags[i].localized_tag_name || tags[i].name;
        }
    }

    return null;
}
function hasDescription (desc, item) {
    const descriptions = item.descriptions;
    if (!descriptions) return false;

    return descriptions.some(function (d) {
        return d.value == desc;
    });
}
function isKillstreak (item) {
    const name = item.market_hash_name;
    if (name.indexOf('Professional Killstreak ') != -1) {
        return 3;
    } else if (name.indexOf('Specialized Killstreak ') != -1) {
        return 2;
    } else if (name.indexOf('Killstreak ') != -1) {
        return 1;
    } else {
        return 0;
    }
}
exports.readJSON = (filename) => {
return jsonfile.readFile(filename)
}
exports.writeJSON = (filename,obj) => {
return jsonfile.writeFile(filename,obj)
}
exports.countInInventory = (array, what) => {
return array.filter(item => item == what).length;
}
exports.parseToRefined = (v) => {
    var i = Math.floor(v),
        f = Math.round((v - i) / 0.11);
    return parseFloat((i + (f === 9 || f * 0.11)).toFixed(2));
    }
exports.parsePrice = (original,keyPrice) => {
var metal = getRight(original.keys * keyPrice) + original.metal;
return { keys: Math.trunc(metal/keyPrice)
       , metal: getRight(metal%keyPrice)
       }
}
exports.promiseRequest = (options) => {
    return request(options);
}
exports.parseToMetal = (obj, keyPrice) => {
var metal = 0;
metal += obj.keys * keyPrice;
metal += obj.metal;
return getRight(metal);
}
function getRight (v) {
var i = Math.floor(v),
    f = Math.round((v - i) / 0.11);
return parseFloat((i + (f === 9 || f * 0.11)).toFixed(2));
}
