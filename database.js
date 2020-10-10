let mongoose = require('mongoose');

const server = "localhost";
const database = "podcasts";

class Database{
  constructor(){
    this._connect()
  }
  
  get_client(){
    return mongoose.connection;
  }

  _connect(){
     mongoose.connect(`mongodb://${server}/${database}`, {useNewUrlParser: true, useUnifiedTopology: true})
       .then(() => {
         console.log('Database connection successful')
       })
       .catch(err => {
         console.error('Database connection error')
       })
  }
}

module.exports = new Database();
