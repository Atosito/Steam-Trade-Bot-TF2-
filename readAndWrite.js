var fs = require('fs');

var readAndWrite = function () {};

readAndWrite.prototype.readDataBase = function(fileName, type){

    return new Promise(function (resolve, reject){
     fs.readFile(fileName, type, (err, data) => {
        if (err) { reject(err); }
        var database = JSON.parse(data);
        return resolve(database);
    })
  });

}

module.exports = readAndWrite;
