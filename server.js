var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
// Use your own mlab user id and password!!!
var mongourl = 'mongodb://localhost:27017/test';

var express = require('express');
var fileUpload = require('express-fileupload');
var app = express();

var bodyParser = require('body-parser');

// middlewares
app.use(fileUpload());
app.use(bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

app.post('/upload', function(req, res) {
    var sampleFile;

    if (!req.files) {
        res.send('No files were uploaded.');
        return;
    }

    MongoClient.connect(mongourl,function(err,db) {
      console.log('Connected to db');
      assert.equal(null,err);
      create(db, req.files.sampleFile, req.body.caption, new Date(req.body.date), function(result) {
        db.close();
        if (result.insertedId != null) {
          res.status(200);
          res.end('Inserted: ' + result.insertedId)
        } else {
          res.status(500);
          res.end(JSON.stringify(result));
        }
      });
    });
    
    /*
    sampleFile = req.files.sampleFile;
    sampleFile.mv('/somewhere/on/your/server/filename.jpg', function(err) {
        if (err) {
            res.status(500).send(err);
        }
        else {
            res.send('File uploaded!');
        }
    });
    */
});

app.get('/download', function(req,res) {
  MongoClient.connect(mongourl,function(err,db) {
    console.log('Connected to db');
    console.log('Finding key = ' + req.query.key)
    assert.equal(null,err);
    var bfile;
    var key = req.query.key;
    if (key != null) {
      read(db, key, function(bfile,mimetype) {
        if (bfile != null) {
          console.log('Found: ' + key)
          res.set('Content-Type',mimetype);
          res.end(bfile);
        } else {
          res.status(404);
          res.end(key + ' not found!');
          console.log(key + ' not found!');
        }
        db.close();
      });
    } else {
      res.status(500);
      res.end('Error: query parameter "key" is missing!');
    }
  });
});

app.get('/read', function(req, res){
  MongoClient.connect(mongourl,function(err,db) {
    console.log('Connected to db');
    console.log(req.query);
    search(db, req.query, function(results){
      res.render('display.ejs', {"photos": results});
    });
  });
});

function create(db,bfile,caption,date,callback) {
  console.log(bfile);
  db.collection('photos').insertOne({
    "data" : new Buffer(bfile.data).toString('base64'),
    "mimetype" : bfile.mimetype,
    "caption" : caption,
    "month" : date.getMonth()+1+'',
    "year" : date.getFullYear()+''
  }, function(err,result) {
    //assert.equal(err,null);
    if (err) {
      console.log('insertOne Error: ' + JSON.stringify(err));
      result = err;
    } else {
      console.log("Inserted _id = " + result.insertId);
    }
    callback(result);
  });
}

function read(db,target,callback) {
  var bfile = null;
  var mimetype = null;
  db.collection('photos').findOne({"_id": ObjectId(target)}, function(err,doc) {
    assert.equal(err,null);
    if (doc != null) {
      bfile = new Buffer(doc.data,'base64');
      mimetype = doc.mimetype;
    }
    callback(bfile,mimetype);
  });
}

function search(db, criteria, callback){
  var photos = [];
  cursor = db.collection('photos').find(criteria, {"data": 0});
  cursor.each(function(err, doc) {
    assert.equal(err, null); 
    if (doc != null) {
      photos.push(doc);
    } else {
      console.log(photos);
      callback(photos);
    }  
  });
}

app.listen(8099, function() {
  console.log('Server is waiting for incoming requests...');
});
