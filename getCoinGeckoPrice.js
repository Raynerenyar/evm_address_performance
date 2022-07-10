'use strict';
const axios = require('axios');

// @function converts timeStamp array into format that coingecko api recognises
// prices from: https://www.coingecko.com/en/api/documentation
// @param timestamp
// @return DD-MM-YYYY from moralis's timestamp
function convertTime(timeStamp) {
  let time = timeStamp.split('T')[0].split('-').reverse().join('-');
  return time;
}

// gets price from coingecko based on token id and date
// @param token id and timestamp in DD-MM-YYYY format in digits
// @return price of token at date input
async function getPriceData(id, timeStamp) {
  // timeStamp = convertTime(timeStamp);
  try {
    let response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${timeStamp}&localization=false`
      // e.g. 'https://api.coingecko.com/api/v3/coins/wrapped-fantom/history?date=10-06-2022&localization=false'
    );
    if (response.data.market_data.current_price.usd != NaN)
      return response.data.market_data.current_price.usd;
    else if (response.data.market_data.current_price.usd == NaN) {
      return 0;
    }
  } catch (err) {
    console.log(err.data);
  }
}

module.exports = {getPriceData, convertTime};
