
exports.correctName = (item) => {
  var name = item.market_hash_name;
  let found = item.descriptions.some(function(el) {
      return el.value === '( Not Usable in Crafting )'
  });
  if (found) {
    if(name.substring(0,4) == 'The '){
      name = `Non-Craftable ${item.market_hash_name.substring(4)}`;
    }else{
      name = `Non-Craftable ${item.market_hash_name}`;
    }
  }
  return name;
}
exports.parseName = (name) => {
  var arr = ['Non-Craftable','Vintage','Strange','Genuine','Haunted'];
  for (var i = 0; i < arr.length; i++) {
    if(name.indexOf('Strange Part:') < 0){
      if(name.includes(arr[i])==true){
        name = name.replace(arr[i],"").trim();
      }
    }
  }
  if (name.substring(0, 4) == "The ") {
      name = name.substring(4).trim();
  }
  return name;
}

exports.isGifted = (item) => {
  var gifted = false;
  var find = item.descriptions.some(function(el) {
      return el.value.indexOf('Gift from') !== -1
  });
  if (find) {
      gifted = true;
  }
  return gifted;
}

