import fetchURL from "../../utils/fetchURL";
import { FetchResult, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";

const M_USD_VAULT_ID =
	"0xb950819c5eba1bb5980f714f2a3b1d8738e3da58a4d9daf5fa21b6c2a7dd1e12";
const URL = `https://aftermath.finance/api/metastable/${M_USD_VAULT_ID}/24hr-volume`;
const M_ETH_VAULT_ID =
	"0x2d6e81126336685a28ea0637109b570510f988bba2b589877c9b579d3cb8cad8";
const URL2 = `https://aftermath.finance/api/metastable/${M_ETH_VAULT_ID}/24hr-volume`;


const fetch = async (timestamp: number): Promise<FetchResult> => {
	let dailyVolume = 0
	const vaults = [M_USD_VAULT_ID, ]
	for (const vault of vaults) {
		const data = await fetchURL(`https://aftermath.finance/api/metastable/${vault}/24hr-volume`);
		dailyVolume += data
	}

	return {
		dailyVolume,
		timestamp,
	};
};

const adapter: SimpleAdapter = {
	version: 1,
	adapter: {
		[CHAIN.SUI]: {
			runAtCurrTime: true,
			fetch,
			start: "2024-01-14",
		},
	},
};

export default adapter;
