"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOG = void 0;
exports.CATALOG = [
    {
        id: 'eurostat:prc_hicp_manr',
        source: 'eurostat',
        datasetCode: 'prc_hicp_manr',
        label: 'Inflácia (HICP ročná miera) - Slovensko',
        description: 'Harmonizovaný index spotrebiteľských cien, ročná miera zmeny',
        unit: '%',
        defaultFilters: { geo: 'SK', lastTimePeriod: '24', coicop: 'CP00' },
    },
    {
        id: 'eurostat:une_rt_m',
        source: 'eurostat',
        datasetCode: 'une_rt_m',
        label: 'Miera nezamestnanosti (mesačná) - Slovensko',
        description: 'Sezónne upravená mesačná miera nezamestnanosti',
        unit: '%',
        defaultFilters: {
            geo: 'SK',
            lastTimePeriod: '24',
            sex: 'T',
            age: 'TOTAL',
            s_adj: 'SA',
            unit: 'PC_ACT',
        },
    },
    {
        id: 'eurostat:namq_10_gdp',
        source: 'eurostat',
        datasetCode: 'namq_10_gdp',
        label: 'Rast HDP (štvrťročný) - Slovensko',
        description: 'Hrubý domáci produkt v trhových cenách, sezónne upravená štvrťročná miera rastu',
        unit: '%',
        defaultFilters: {
            geo: 'SK',
            lastTimePeriod: '24',
            freq: 'Q',
            na_item: 'B1GQ',
            s_adj: 'SCA',
            unit: 'CLV_PCH_PRE',
        },
    },
    {
        id: 'datacube:sp1002qs',
        source: 'datacube',
        datasetCode: 'sp1002qs',
        label: 'Index cien nehnuteľností (štvrťročný) - Slovensko',
        description: 'Štvrťročný transakčný cenový index pre nehnuteľnosti, priemer 2010 = 100',
        unit: 'index',
        defaultFilters: {},
    },
    {
        id: 'datacube:zo0020ms',
        source: 'datacube',
        datasetCode: 'zo0020ms',
        label: 'Dovoz a vývoz podľa kategórie BEC (mesačný) - Slovensko',
        description: 'Zahraničný obchod podľa hlavných ekonomických kategórií (BEC Rev. 4)',
        unit: 'milióny EUR',
        defaultFilters: {},
    },
    {
        id: 'susr:pr0101qs',
        source: 'susr',
        datasetCode: 'pr0101qs',
        label: 'Miera nezamestnanosti (štvrťročná) - Slovensko',
        description: 'Nezamestnanosť podľa výberového zisťovania pracovných síl (od roku 2021)',
        unit: '%',
        defaultFilters: {},
        susrConfig: {
            pathSegments: ['last5', '1. Q.,2. Q.,3. Q.,4. Q.', 'UKAZ03', 'NACE01'],
        },
    },
];
//# sourceMappingURL=catalog.data.js.map