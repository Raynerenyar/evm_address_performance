'use strict';
const axios = require('axios');

// @function converts timeStamp array into format that coingecko api recognises
// prices from: https://www.coingecko.com/en/api/documentation
// @param timestamp
// @return dd-MM-yyyy from moralis's timestamp
function reverseDayandYear(timeStamp) {
  let time = timeStamp.split('T')[0].split('-').reverse().join('-');
  return time;
}

// gets price from coingecko based on token id and date
// @param token id and timestamp in DD-MM-YYYY format in digits
// @return price of token at date input
async function getPriceData(id, timeStamp) {
  // timeStamp = reverseDayandYear(timeStamp);
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

const getIndices = (content) => {
  /*get html after the first <tr> tag*/
  let startIndex = content.indexOf('<tr>') - 2;
  /* get html before the last </tr> tag */
  let endIndex = content.length - (content.lastIndexOf('</tr>') + 5);
  return {startIndex, endIndex};
};

// webscraps coingecko website for token prices
// @Param nameID Id, startDate and endDate in yyyy-MM-dd
async function webScrapPrices(nameID, startDate, endDate, daysToLookBack) {
  const numOfPages = Math.ceil(daysToLookBack / 60);
  const tokenPriceList = {};
  try {
    for (let a = 1; a <= numOfPages; ++a) {
      // one page 60 rows of data
      const url = `https://www.coingecko.com/en/coins/${nameID}/historical_data?start_date=${startDate}&end_date=${endDate}&page=${a}`;
      const response = await axios(url);
      const html = response.data;
      const {startIndex, endIndex} = getIndices(html);
      const content = html.slice(startIndex, -endIndex);
      const length = content.match(/tr>/gm).length / 2; // can check if length === 1 to stop webscrap
      let removedWhitespace = content.replace(/\s/gm, '').replace(/\\n/gm, '');
      const sortedAccordingToRows = [];
      for (let b = 0; b < length; b++) {
        // get each table row in html text and push to an array
        sortedAccordingToRows.push(
          removedWhitespace.split(/<tr>(.*)/)[1].split(/<\/tr>(.*)/)[0]
        );
        // remove the part of the html that has been pushed to array
        removedWhitespace = removedWhitespace
          .split(/<tr>(.*)/)[1]
          .split(/<\/tr>(.*)/)[1];
      }
      // date, marketcap volume, open, close (5 columns)
      // removes first element
      sortedAccordingToRows.shift();
      let eachRowContent = [];
      const rowLength = sortedAccordingToRows.length;
      for (let c = 0; c < rowLength; ++c) {
        eachRowContent = [];
        // get the total number of columns based on num of td and th tags
        const totalthtdTag =
          sortedAccordingToRows[c].match(/td/gm).length +
          sortedAccordingToRows[c].match(/th/gm).length;
        const totalNumCol = totalthtdTag / 2;
        for (let d = 0; d < totalNumCol; ++d) {
          let cellContent;
          // for when end of string is >
          if (sortedAccordingToRows[c].split(/>([0-9,\w,(,$,-].*)/)[1] == null)
            continue;
          // get first instance of text between >text<
          cellContent = sortedAccordingToRows[c]
            .split(/>([0-9,\w,(,$,-].*)/)[1]
            .split(/<(.*)/)
            .shift();
          if (cellContent.includes('$')) {
            cellContent = Number(
              cellContent.replace(/\$/gm, '').replace(/[,]/gm, '')
            );
          }
          // if no text, just >< cellContent is undefined
          if (cellContent === undefined) {
            sortedAccordingToRows[c] = sortedAccordingToRows[c]
              .split(/>([0-9,\w,(,$,-].*)/)[1]
              .split(/<(.*)/)[1];
            continue;
          } else {
            eachRowContent.push(cellContent);
            // removes the html content that has already been parsed (get text from within td tag)
            sortedAccordingToRows[c] = sortedAccordingToRows[c]
              .split(/>([0-9,\w,(,$,-].*)/)[1]
              .split(/<(.*)/)[1];
          }
        }
        // if no. of columns < total columns, fill in cell with data from previous row
        if (eachRowContent.length < 5) {
          const fillIn = tableContent[c - 1];
          eachRowContent.unshift(fillIn[0], fillIn[1], fillIn[2]);
        }
        // splice to remove marketcap and volume data
        eachRowContent.splice(1, 2);
        let price = eachRowContent[1];
        if (price === 'N/A') price = eachRowContent[2];
        tokenPriceList[eachRowContent[0]] = price;
      }
    }
  } catch (err) {
    console.log(err);
  }
  return tokenPriceList;
}

module.exports = {getPriceData, reverseDayandYear, webScrapPrices};
