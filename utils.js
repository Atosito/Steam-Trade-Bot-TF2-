
const jsonfile = require('jsonfile')

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
