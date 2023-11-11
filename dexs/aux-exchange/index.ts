import { FetchResultVolume, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import axios from "axios";
import { getPrices } from "../../utils/prices";

interface ISwapEventData {
  in_au: string;
  out_au: string,
  out_coin_type: string;
  in_coin_type: string;
  timestamp: string;
}

const account = '0xbd35135844473187163ca197ca93b2ab014370587bb0ed3befff9e902d6bb541';
const getToken = (i: string) => i.split('<')[1].replace('>', '').split(', ');
const fullnodeurl = 'https://fullnode.mainnet.aptoslabs.com/v1';

const fetch = async (timestamp: number): Promise<FetchResultVolume> => {
  const fromTimestamp = timestamp - 86400;
  const toTimestamp = timestamp;
  const account_resource: any[] = (await axios.get(`${fullnodeurl}/accounts/${account}/resources`)).data
  const pools = account_resource.filter(e => e.type?.includes('amm::Pool'))
    .map((e: any) => {
      const [token0, token1] = getToken(e.type);
      return {
        type: e.type,
        token0,
        token1,
        swap_events: {
          counter: e.data.swap_events.counter,
          creation_num: e.data.swap_events.guid.id.creation_num,
        },
        timestamp: e.data.timestamp,
      }
    })

    const logs_swap: ISwapEventData[] = (await Promise.all(pools.map(p => getSwapEvent(p, fromTimestamp)))).flat()
      .filter(e => toUnixTime(e.timestamp) > fromTimestamp && toUnixTime(e.timestamp) < toTimestamp)
    const coins = [...new Set([...logs_swap.map(p => `${CHAIN.APTOS}:${p.in_coin_type}`), ...logs_swap.map(p => `${CHAIN.APTOS}:${p.out_coin_type}`)])]
    const price = (await getPrices(coins, timestamp));
    const dailyVolume = logs_swap.map((e: ISwapEventData) => {
      const token0Price = price[`${CHAIN.APTOS}:${e.in_coin_type}`]?.price || 0;
      const token1Price = price[`${CHAIN.APTOS}:${e.out_coin_type}`]?.price || 0;
      const token0Decimals = price[`${CHAIN.APTOS}:${e.in_coin_type}`]?.decimals || 0;
      const token1Decimals = price[`${CHAIN.APTOS}:${e.out_coin_type}`]?.decimals || 0;
      const in_au = (Number(e.in_au) / 10 ** token0Decimals) * token0Price;
      const out_au = (Number(e.out_au) / 10 ** token1Decimals) * token1Price;
      return token0Price ? in_au : out_au;
    }).reduce((a: number, b: number) => a + b, 0)

  return {
    timestamp,
    dailyVolume: dailyVolume.toString(),
  }
}

const getSwapEvent = async (pool: any, fromTimestamp: number): Promise<ISwapEventData[]> => {
  const swap_events: any[] = [];
  let start = (pool.swap_events.counter - 100) < 0 ? 0 : pool.swap_events.counter - 100;
  while (true) {
    if (start < 0) break;
    try {
      const getEventByCreation = `${fullnodeurl}/accounts/${account}/events/${pool.swap_events.creation_num}?start=${start}&limit=100`;
      const event: any[] = (await axios.get(getEventByCreation)).data;
      const listSequence: number[] = event.map(e =>  Number(e.sequence_number))
      swap_events.push(...event)
      const lastMin = Math.min(...listSequence)
      if (lastMin >= Infinity || lastMin <= -Infinity) break;
      const lastTimestamp = event.find(e => Number(e.sequence_number) === lastMin)?.data.timestamp
      const lastTimestampNumber = Number((Number(lastTimestamp)/1e6).toString().split('.')[0])
      if (lastTimestampNumber < fromTimestamp) break;
      start = lastMin - 101 > 0 ? lastMin - 101 : 0;
    } catch {
      start = start - 101 > 0 ? start - 101 : 0;
    }
  }
  return swap_events.map(e => e.data)
}
const toUnixTime = (timestamp: string) => Number((Number(timestamp)/1e6).toString().split('.')[0])

const adapter: SimpleAdapter = {
  adapter: {
    [CHAIN.APTOS]: {
      fetch: fetch,
      start: async () => 1699488000,
      runAtCurrTime: true,
    },
  },
};

export default adapter;
