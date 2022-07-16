'use strict';
const PORT = process.env.PORT || 8080;
const express = require('express');
const cors = require('cors');
const app = express();
const main = require('./main.js');
app.use(cors());
app.use(express.json());
app.use(express.static('client'));
app.listen(PORT, () => console.log(`server running on port ${PORT}`));

app.get('/', function (req, res) {
  res.json('Welcome');
});

app.post('/api', (req, res) => {
  console.log('Front end address received on server');
  const address = req.body.address;
  main.startRunning(address).then((response) => {
    console.log(`Sending chart data`);
    res.json({status: 'server sent success', data: response});
  });
});
