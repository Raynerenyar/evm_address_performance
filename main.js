'use strict';
const {addDays, endOfYesterday, format} = require('date-fns');
const {
  getPriceData,
  reverseDayandYear,
  webScrapPrices,
} = require('./getPrice.js');
require('dotenv').config();
const Moralis = require('moralis/node');
const EventEmitter = require('events');
const master_key = process.env.MASTER_KEY;
const serverUrl = process.env.SERVERURL;
const appId = process.env.APPID;
// init Moralis server
Moralis.start({serverUrl, appId, master_key});

// prototype
function Wallet() {
  this.chart = {dates: new Set(), values: []};
}
// prototype
function Dates(date, wallet) {
  this.keyLength = 0;
  wallet[`${date}`] = this;
  wallet.chart.dates.add(date);
}
// prototype
function Asset(b, address, name, date, balance, price, wallet) {
  this.address = address;
  this.name = name;
  this.price = price;
  this.balance = balance;
  wallet[`${date}`][b] = this;
  wallet[`${date}`].keyLength += 1;
}
// prototype
function WhiteList() {}
// sets up global whitelist
const globalWhitelist = new WhiteList();
// TODO: undefineds to be amended for LP/autocompounder tokens
const theUndefineds = new Set();
let WLaddressSet;

WhiteList.prototype.updateWhitelist = function (chain, tokenId, tokenAddy) {
  if (chain === 'eth') chain = 'ethereum';
  if (chain === 'bsc') chain = 'binance_smart_chain';
  // chain === 'bsc' ? 'binance_smart_chain' : 'binance_smart_chain';
  const chainSet = new Set(Object.keys(this));
  if (!chainSet.has(chain)) {
    this[chain] = {addyLength: 0};
  }
  WLaddressSet = new Set(Object.keys(this[chain]));
  if (!WLaddressSet.has(tokenAddy)) {
    this[chain][tokenAddy] = tokenId;
    // reassign WLaddressSet
    WLaddressSet = new Set(Object.keys(this[chain]));
    this[chain].addyLength += 1;
  }
};

// init global priceList prototype
function globalPriceList() {}
let globalPriceListTokenIdSet;

// create whitelist base on tokens in wallet and coingecko Id
// if there's price on coingecko it is whitelisted
const queryDB = async (balances, chain) => {
  const coingeckoIDs = await Moralis.Object.extend('TokenDB');
  const query = new Moralis.Query(coingeckoIDs);
  const balLength = balances.length;
  for (let i = 0; i < balLength; i++) {
    if (theUndefineds.has(balances[i].token_address)) break;
    query.equalTo('contract_address', balances[i].token_address);
    const results = await query.first();
    if (results != undefined) {
      globalWhitelist.updateWhitelist(
        chain,
        results.get('coinGecko_id'),
        results.get('contract_address')
      );
    } else theUndefineds.add(balances[i].token_address);
  }
};

// get blocks stored on DB
// @param start date and chain (YYYY-MM-DD)
const getBlocksFromDB = async function (startDate, chain) {
  const blocksInDB = await Moralis.Object.extend('BlocksOfEachChain');
  const queryStartDate = new Moralis.Query(blocksInDB);
  queryStartDate.equalTo('date', startDate);
  const queryGreaterThan = new Moralis.Query(blocksInDB);
  queryGreaterThan.greaterThan('date', startDate);
  const StarteEnd = await Moralis.Query.and(
    Moralis.Query.or(queryStartDate, queryGreaterThan)
  );
  const results = await StarteEnd.find();
  const blockArray = new Set();
  for (let i = 0; i < results.length; ++i) {
    blockArray.add(results[i].get(chain));
  }
  return blockArray;
};

// get array of dates with start and end date
const getDaysArray = (start, end) => {
  const dateArray = new Set();
  const endDate = new Date(end);
  for (let dt = new Date(start); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
    dateArray.add(JSON.stringify(new Date(dt)).slice(1, 11));
  }
  return dateArray;
};

// get token balances of a wallet address at given param block
// @param array of blocks, token address, and chain
async function getTokenBalances(chain, address, block) {
  const options = {
    chain: chain,
    address: address, // wallet or LP addresses
    to_block: block,
  };
  const balances = await Moralis.Web3API.account.getTokenBalances(options);
  await queryDB(balances, chain);
  const WLTokensInAddy = {};
  const balancesLength = balances.length;
  for (let i = 0; i < balancesLength; i++) {
    if (WLaddressSet.has(balances[i].token_address)) {
      WLTokensInAddy[balances[i].token_address] =
        balances[i].balance / 10 ** balances[i].decimals;
    }
  }
  return WLTokensInAddy;
}

// init the entire query process
async function run(address, startDate, endDate, chain, daysToLookBack) {
  address = address.toLowerCase();
  let wallet = new Wallet();
  const dateSet = getDaysArray(new Date(startDate), new Date(endDate));
  const dateArray = Array.from(dateSet).reverse();
  const dateArrayLength = dateArray.length;
  // prefill array, creates equal num of elements in array as there are dates
  wallet.chart.values = new Array(dateArrayLength).fill(0);
  const blockArray = await getBlocksFromDB(startDate, chain);
  const block = Array.from(blockArray);
  globalPriceListTokenIdSet = new Set(Object.keys(globalPriceList));
  // for each date, get token balances and price of each address in wallet
  for (let a = 0; a < dateArrayLength; ++a) {
    new Dates(dateArray[a], wallet);
    const WLTokensInAddy = await getTokenBalances(chain, address, block[a]);
    const tokenLength = Object.keys(WLTokensInAddy).length;
    const addressArr = Object.keys(WLTokensInAddy);
    for (let b = 0; b < tokenLength; ++b) {
      const currentTokenName = globalWhitelist[chain][addressArr[b]];
      let tokenPricesFromWebpage;
      // skips webscrapping if prices are already in globalPriceList
      if (!globalPriceListTokenIdSet.has(currentTokenName)) {
        tokenPricesFromWebpage = await webScrapPrices(
          currentTokenName,
          startDate,
          endDate,
          daysToLookBack
        );
        globalPriceList[currentTokenName] = tokenPricesFromWebpage;
        globalPriceListTokenIdSet = new Set(Object.keys(globalPriceList));
      }
      const price = globalPriceList[currentTokenName][dateArray[a]];
      const newAsset = new Asset(
        b,
        addressArr[b],
        currentTokenName,
        dateArray[a],
        WLTokensInAddy[addressArr[b]],
        price,
        wallet
      );
      // calculate total value of wallet at date
      wallet.chart.values[a] += newAsset.price * newAsset.balance;
    }
  }
  wallet.chart.dates = Array.from(wallet.chart.dates);
  return wallet;
}

// let walletAddress = '0xfbF535224f1f473b6438bf50Fbf3200b8659eDDE';
const startRunning = async (walletAddress) => {
  // console.time('server side retrieve data');
  // TODO: get userEndDateObj from front end (should be date from day before)
  const userEndDate = '2022-06-10';
  // const userEndDateObj = new Date('2022-06-10');
  // userEndDate to be yesterday's date
  // const yesterday = endOfYesterday();
  // TODO: add user's days back to get data
  const daysToLookBack = 10;
  const dateNumDaysAgo = addDays(new Date('2022-06-10'), -(daysToLookBack - 1));
  const userStartDate = format(dateNumDaysAgo, 'yyyy-MM-dd');
  let walletArray = await run(
    walletAddress,
    userStartDate, // start date
    userEndDate, // end date
    'fantom', //TODO: add array of chains
    daysToLookBack
  );
  // console.timeEnd('server side retrieve data');
  return walletArray;
};

module.exports = {startRunning};

/* 
0xfbF535224f1f473b6438bf50Fbf3200b8659eDDE protofi
*/

//TODO: put coingecko branding for price api
// https://www.coingecko.com/en/branding

/* moralis uses short form names like eth, bsc. coingecko uses full names
chains = ('ethereum', 'polygon', 'binance-smart-chain', 'avalanche', 'fantom');
chains = ('eth', 'polygon', 'bsc', 'avalanche', 'fantom'); */
