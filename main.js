'use strict';
const getCoinGeckoPrice = require('./getCoinGeckoPrice.js');
const Moralis = require('moralis/node');
require('dotenv').config();
const {addDays, endOfYesterday, format} = require('date-fns');
const master_key = process.env.MASTER_KEY;
const serverUrl = process.env.SERVERURL;
const appId = process.env.APPID;
Moralis.start({serverUrl, appId, master_key});

function Wallet() {
  this.chart = {dates: new Set(), values: []};
}

function Dates(date, wallet) {
  this.keyLength = 0;
  wallet[`${date}`] = this;
  wallet.chart.dates.add(date);
}

function Asset(b, address, name, date, balance, price, wallet) {
  this.address = address;
  this.name = name;
  this.price = price;
  this.balance = balance;
  wallet[`${date}`][b] = this;
  wallet[`${date}`].keyLength += 1;
}

function WhiteList() {}
// sets up global whitelist
const whitelist = new WhiteList();
const theUndefineds = new Set();

WhiteList.prototype.updateWhitelist = function (chain, tokenId, tokenAddy) {
  chain === 'eth' ? 'ethereum' : 'ethereum';
  chain === 'bsc' ? 'binance_smart_chain' : 'binance_smart_chain';
  if (!Object.keys(this).includes(chain)) {
    this[chain] = {name: new Set(), address: new Set()};
  }
  if (!this[chain].address.has(tokenId)) {
    this[chain].name.add(tokenId);
    this[chain].address.add(tokenAddy);
  }
};

WhiteList.prototype.getAddressArray = function (chain) {
  return Array.from(this[chain].address);
};

WhiteList.prototype.getNameArray = function (chain) {
  return Array.from(this[chain].name);
};

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
      whitelist.updateWhitelist(
        chain,
        results.get('coinGecko_id'),
        results.get('contract_address')
      );
    } else theUndefineds.add(balances[i].token_address);
  }
};

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
  const WhitelistedTokensInAddy = {address: [], balance: []};
  const balancesLength = balances.length;
  for (let i = 0; i < balancesLength; i++) {
    if (whitelist[chain].address.has(balances[i].token_address)) {
      WhitelistedTokensInAddy.address.push(balances[i].token_address);
      WhitelistedTokensInAddy.balance.push(
        balances[i].balance / 10 ** balances[i].decimals
      );
    }
  }
  return WhitelistedTokensInAddy;
}

async function run(address, startDate, endDate, chain) {
  address = address.toLowerCase();
  let wallet = new Wallet();
  const dateSet = getDaysArray(new Date(startDate), new Date(endDate));
  const dateArray = Array.from(dateSet).reverse();
  const dateArrayLength = dateArray.length;
  wallet.chart.values = new Array(dateArrayLength).fill(0);
  for (let a = 0; a < dateArrayLength; ++a) {
    new Dates(dateArray[a], wallet);
    const blockArray = await getBlocksFromDB(startDate, chain);
    // block = await getBlocks(dateArray[a], chain);
    const block = Array.from(blockArray);
    const WhitelistedTokensInAddy = await getTokenBalances(
      chain,
      address,
      block[a]
    );
    const WL_TokensInAddy_Length = WhitelistedTokensInAddy.address.length;
    // for each date, get token balances and price of each address in wallet
    // add to wallet Object
    for (let b = 0; b < WL_TokensInAddy_Length; ++b) {
      const index = whitelist
        .getAddressArray(chain)
        .findIndex((addy) => addy === WhitelistedTokensInAddy.address[b]);
      const convertedDate = getCoinGeckoPrice.convertTime(dateArray[a]);
      // const convertedDate = format(dateArray[a], 'dd-MM-yyyy');
      const price = await getCoinGeckoPrice.getPriceData(
        whitelist.getNameArray(chain)[index],
        convertedDate
      );
      const newAsset = new Asset(
        b,
        WhitelistedTokensInAddy.address[b],
        whitelist.getNameArray(chain)[index],
        dateArray[a],
        WhitelistedTokensInAddy.balance[b],
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
  let walletArray = await run(
    walletAddress,
    '2022-06-01', // start date
    '2022-06-10', // end date
    'fantom'
  );
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
