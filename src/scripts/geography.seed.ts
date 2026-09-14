import mongoose from "mongoose";

import Zone from "../models/zone.model";
import Region from "../models/region.model";
import Area from "../models/area.model";
import Territory from "../models/territory.model";

type SeedZone = {
  name: string;
  description?: string;
};

type SeedRegion = {
  name: string;
  zone: string;
  description?: string;
};

type SeedArea = {
  name: string;
  region: string;
  description?: string;
};

type SeedTerritory = {
  name: string;
  area: string;
  description?: string;
};

/**
 * ============================================================
 * ZONES
 * ============================================================
 */

const zones: SeedZone[] = [
  {
    name: "North",
    description: "North Zone",
  },
  {
    name: "East",
    description: "East Zone",
  },
  {
    name: "South",
    description: "South Zone",
  },
  {
    name: "West",
    description: "West Zone",
  },
];

/**
 * ============================================================
 * REGIONS
 * ============================================================
 */

const regions: SeedRegion[] = [
  {
    name: "Bogura Region",
    zone: "North",
  },
  {
    name: "Rangpur Region",
    zone: "North",
  },
  {
    name: "Dinajpur Region",
    zone: "North",
  },
  {
    name: "Naogaon Region",
    zone: "North",
  },
  {
    name: "Rajshahi Region",
    zone: "North",
  },
  {
    name: "Dhaka Region",
    zone: "East",
  },
  {
    name: "Maymensingh Region",
    zone: "East",
  },
  {
    name: "Kushtia Region",
    zone: "South",
  },
  {
    name: "Jashore Region",
    zone: "South",
  },
  {
    name: "Comilla Region",
    zone: "West",
  },
  {
    name: "Chittagong Region",
    zone: "West",
  },
  {
    name: "Sylhet Region",
    zone: "West",
  },
];

/**
 * ============================================================
 * AREAS
 * ============================================================
 */

const areas: SeedArea[] = [
  {
    name: "Munshigonj Area",
    region: "Dhaka Region",
  },
  {
    name: "Sylhet Area",
    region: "Sylhet Region",
  },
  {
    name: "Hobigonj Area",
    region: "Sylhet Region",
  },
  {
    name: "Khagrachori Area",
    region: "Chittagong Region",
  },
  {
    name: "Chittagong Area",
    region: "Chittagong Region",
  },
  {
    name: "Noakhali Area",
    region: "Comilla Region",
  },
  {
    name: "Comilla Area",
    region: "Comilla Region",
  },
  {
    name: "Khulna Area",
    region: "Jashore Region",
  },
  {
    name: "Jashore Area",
    region: "Jashore Region",
  },
  {
    name: "Faridpur Area",
    region: "Kushtia Region",
  },
  {
    name: "Kushtia Area",
    region: "Kushtia Region",
  },
  {
    name: "Jamalpur/Sherpur Area",
    region: "Maymensingh Region",
  },
  {
    name: "Maymensingh Area",
    region: "Maymensingh Region",
  },
  {
    name: "Bogura Area",
    region: "Bogura Region",
  },
  {
    name: "Manikgonj Area",
    region: "Dhaka Region",
  },
  {
    name: "Pabna Area",
    region: "Rajshahi Region",
  },
  {
    name: "Chapainawabgonj Area",
    region: "Rajshahi Region",
  },
  {
    name: "Rajshahi Area",
    region: "Rajshahi Region",
  },
  {
    name: "Mohadebpur Area",
    region: "Naogaon Region",
  },
  {
    name: "Potnitala Area",
    region: "Naogaon Region",
  },
  {
    name: "Thakurgaon Area",
    region: "Dinajpur Region",
  },
  {
    name: "Dinajpur Area",
    region: "Dinajpur Region",
  },
  {
    name: "Kurigram Area",
    region: "Rangpur Region",
  },
  {
    name: "Rangpur Area",
    region: "Rangpur Region",
  },
  {
    name: "Gaibandha Area",
    region: "Bogura Region",
  },
];

/**
 * ============================================================
 * TERRITORIES
 * ============================================================
 */

const territories: SeedTerritory[] = [
  {
    name: "Kurigram Territory",
    area: "Kurigram Area",
  },
  {
    name: "Panchagorh Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Nator Territory",
    area: "Pabna Area",
  },
  {
    name: "Rangpur Territory",
    area: "Rangpur Area",
  },
  {
    name: "Bogura Territory",
    area: "Bogura Area",
  },
  {
    name: "Gomostapur Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Birganj Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Nawhata Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Nekmorod Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Puthia Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Kalai Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Dhupchaci Territory",
    area: "Bogura Area",
  },
  {
    name: "Chapainawabgonj Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Pirgacha Territory",
    area: "Rangpur Area",
  },
  {
    name: "Sapahar Territory",
    area: "Potnitala Area",
  },
  {
    name: "Nilphamari Territory",
    area: "Kurigram Area",
  },
  {
    name: "Shibgonj Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Fulbari Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Raninagar Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Ranishankar Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Pabna Sadar Territory",
    area: "Pabna Area",
  },
  {
    name: "Chatmohor Territory",
    area: "Pabna Area",
  },
  {
    name: "Mataji Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Nandigram Territory",
    area: "Bogura Area",
  },
  {
    name: "Bagmara Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Gobindagonj Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Sherpur Territory",
    area: "Bogura Area",
  },
  {
    name: "Godagari Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Ullahpara Territory",
    area: "Bogura Area",
  },
  {
    name: "Dhamoirhat Territory",
    area: "Potnitala Area",
  },
  {
    name: "Pirganj Territory",
    area: "Rangpur Area",
  },
  {
    name: "Nashole Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Shotibari Territory",
    area: "Rangpur Area",
  },
  {
    name: "Manda Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Lalmonirhat Territory",
    area: "Kurigram Area",
  },
  {
    name: "Amnura Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Dinajpur Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Porsha Territory",
    area: "Potnitala Area",
  },
  {
    name: "Birol Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Ishwardi Territory",
    area: "Pabna Area",
  },
  {
    name: "Thakurgaon Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Naogaon Sadar Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Boda Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Singara Territory",
    area: "Pabna Area",
  },
  {
    name: "Taherpur Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Mohadebpur Terirtory",
    area: "Mohadebpur Area",
  },
  {
    name: "Badal Gachi Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Potnitala Territory",
    area: "Potnitala Area",
  },
  {
    name: "Tanore Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Gaibandha Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Gazipur Territory",
    area: "Manikgonj Area",
  },
  {
    name: "Nandigram Territory",
    area: "Bogura Area",
  },
  {
    name: "Narayanganj Territory",
    area: "Munshigonj Area",
  },
  {
    name: "Bagmara Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Maymensingh Territory",
    area: "Maymensingh Area",
  },
  {
    name: "Sherpur Territory",
    area: "Bogura Area",
  },
  {
    name: "Nandail Territory",
    area: "Maymensingh Area",
  },
  {
    name: "Fulbariya Territory",
    area: "Maymensingh Area",
  },
  {
    name: "Gobindagonj Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Muktagacha Territory",
    area: "Maymensingh Area",
  },
  {
    name: "Godagari Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Nakla Territory",
    area: "Jamalpur/Sherpur Area",
  },
  {
    name: "Ullahpara Territory",
    area: "Bogura Area",
  },
  {
    name: "Jhenaigati Territory",
    area: "Jamalpur/Sherpur Area",
  },
  {
    name: "Dhamoirhat Territory",
    area: "Potnitala Area",
  },
  {
    name: "Kushtia Territory",
    area: "Kushtia Area",
  },
  {
    name: "Pirganj Territory",
    area: "Rangpur Area",
  },
  {
    name: "Dauilatpur Territory",
    area: "Kushtia Area",
  },
  {
    name: "Nashole Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Faridpur Territory",
    area: "Faridpur Area",
  },
  {
    name: "Shotibari Territory",
    area: "Rangpur Area",
  },
  {
    name: "Modukhali Territory",
    area: "Faridpur Area",
  },
  {
    name: "Manda Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Jashore Territory",
    area: "Jashore Area",
  },
  {
    name: "Lalmonirhat Territory",
    area: "Kurigram Area",
  },
  {
    name: "Jikorgacha Territory",
    area: "Jashore Area",
  },
  {
    name: "Amnura Territory",
    area: "Chapainawabgonj Area",
  },
  {
    name: "Jhenaidah Territory",
    area: "Jashore Area",
  },
  {
    name: "Dinajpur Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Meherpur Territory",
    area: "Kushtia Area",
  },
  {
    name: "Porsha Territory",
    area: "Potnitala Area",
  },
  {
    name: "Satkhira Territory",
    area: "Khulna Area",
  },
  {
    name: "Birol Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Bagerhat Territory",
    area: "Khulna Area",
  },
  {
    name: "Ishwardi Territory",
    area: "Pabna Area",
  },
  {
    name: "Feni Territory",
    area: "Comilla Area",
  },
  {
    name: "Thakurgaon Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Debidwar Territory",
    area: "Comilla Area",
  },
  {
    name: "Naogaon Sadar Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Chandina Territory",
    area: "Comilla Area",
  },
  {
    name: "Noakhali Territory",
    area: "Noakhali Area",
  },
  {
    name: "Singara Territory",
    area: "Pabna Area",
  },
  {
    name: "Nekmorod Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Mohadebpur Terirtory",
    area: "Mohadebpur Area",
  },
  {
    name: "Badal Gachi Territory",
    area: "Mohadebpur Area",
  },
  {
    name: "Potnitala Territory",
    area: "Potnitala Area",
  },
  {
    name: "Tanore Territory",
    area: "Rajshahi Area",
  },
  {
    name: "Gaibandha Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Vhaluka Territory",
    area: "Maymensingh Area",
  },
  {
    name: "Panchagorh Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Thakurgaon Territory",
    area: "Thakurgaon Area",
  },
  {
    name: "Fulbari Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Mohadebpur Terirtory",
    area: "Mohadebpur Area",
  },
  {
    name: "Birganj Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Dinajpur Territory",
    area: "Dinajpur Area",
  },
  {
    name: "Nilphamari Territory",
    area: "Kurigram Area",
  },
  {
    name: "Lalmonirhat Territory",
    area: "Kurigram Area",
  },
  {
    name: "Kurigram Territory",
    area: "Kurigram Area",
  },
  {
    name: "Shotibari Territory",
    area: "Rangpur Area",
  },
  {
    name: "Pirgacha Territory",
    area: "Rangpur Area",
  },
  {
    name: "Pirganj Territory",
    area: "Rangpur Area",
  },
  {
    name: "Rangpur Territory",
    area: "Rangpur Area",
  },
  {
    name: "Ullahpara Territory",
    area: "Bogura Area",
  },
  {
    name: "Kalai Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Gobindagonj Territory",
    area: "Gaibandha Area",
  },
  {
    name: "Gaibandha Territory",
    area: "Gaibandha Area",
  },
];

/**
 * ============================================================
 * SEED FUNCTION
 * ============================================================
 */

export async function seedGeography() {
  console.log("\n===========================================");
  console.log("          GEOGRAPHY MASTER SEED");
  console.log("===========================================\n");

  const session = await mongoose.startSession();

  let createdZones = 0;
  let existingZones = 0;

  let createdRegions = 0;
  let existingRegions = 0;

  let createdAreas = 0;
  let existingAreas = 0;

  let createdTerritories = 0;
  let existingTerritories = 0;

  try {
    session.startTransaction();

    /**
     * --------------------------------------------------------
     * 1. ZONES
     * --------------------------------------------------------
     */

    const zoneMap = new Map<string, any>();

    for (const item of zones) {
      let zone = await Zone.findOne({
        name: item.name,
      }).session(session);

      if (!zone) {
        zone = await Zone.create(
          [
            {
              name: item.name,
              description: item.description || "",
            },
          ],
          { session },
        ).then((docs) => docs[0]);

        createdZones++;

        console.log(`+ Zone created: ${item.name}`);
      } else {
        existingZones++;

        console.log(`= Zone exists: ${item.name}`);
      }

      zoneMap.set(item.name, zone);
    }

    /**
     * --------------------------------------------------------
     * 2. REGIONS
     * --------------------------------------------------------
     */

    const regionMap = new Map<string, any>();

    for (const item of regions) {
      const zone = zoneMap.get(item.zone);

      if (!zone) {
        throw new Error(
          `Zone "${item.zone}" not found for region "${item.name}".`,
        );
      }

      let region = await Region.findOne({
        name: item.name,
        zone: zone._id,
      }).session(session);

      if (!region) {
        region = await Region.create(
          [
            {
              name: item.name,
              zone: zone._id,
              description: item.description || "",
            },
          ],
          { session },
        ).then((docs) => docs[0]);

        createdRegions++;

        console.log(`+ Region created: ${item.name} → ${item.zone}`);
      } else {
        existingRegions++;

        console.log(`= Region exists: ${item.name} → ${item.zone}`);
      }

      regionMap.set(item.name, region);
    }

    /**
     * --------------------------------------------------------
     * 3. AREAS
     * --------------------------------------------------------
     */

    const areaMap = new Map<string, any>();

    for (const item of areas) {
      const region = regionMap.get(item.region);

      if (!region) {
        throw new Error(
          `Region "${item.region}" not found for area "${item.name}".`,
        );
      }

      let area = await Area.findOne({
        name: item.name,
        region: region._id,
      }).session(session);

      if (!area) {
        area = await Area.create(
          [
            {
              name: item.name,
              region: region._id,
              description: item.description || "",
            },
          ],
          { session },
        ).then((docs) => docs[0]);

        createdAreas++;

        console.log(`+ Area created: ${item.name} → ${item.region}`);
      } else {
        existingAreas++;

        console.log(`= Area exists: ${item.name} → ${item.region}`);
      }

      areaMap.set(item.name, area);
    }

    /**
     * --------------------------------------------------------
     * 4. TERRITORIES
     * --------------------------------------------------------
     */

    for (const item of territories) {
      const area = areaMap.get(item.area);

      if (!area) {
        throw new Error(
          `Area "${item.area}" not found for territory "${item.name}".`,
        );
      }

      const existingTerritory = await Territory.findOne({
        name: item.name,
        area: area._id,
      }).session(session);

      if (!existingTerritory) {
        await Territory.create(
          [
            {
              name: item.name,
              area: area._id,
              description: item.description || "",
            },
          ],
          { session },
        );

        createdTerritories++;

        console.log(`+ Territory created: ${item.name} → ${item.area}`);
      } else {
        existingTerritories++;

        console.log(`= Territory exists: ${item.name} → ${item.area}`);
      }
    }

    await session.commitTransaction();

    console.log("\n===========================================");
    console.log("       GEOGRAPHY MASTER SEED DONE");
    console.log("===========================================");

    console.log(`Zones Created       : ${createdZones}`);
    console.log(`Zones Existing      : ${existingZones}`);

    console.log(`Regions Created     : ${createdRegions}`);
    console.log(`Regions Existing    : ${existingRegions}`);

    console.log(`Areas Created       : ${createdAreas}`);
    console.log(`Areas Existing      : ${existingAreas}`);

    console.log(`Territories Created : ${createdTerritories}`);
    console.log(`Territories Existing: ${existingTerritories}`);

    console.log("-------------------------------------------");

    console.log(`Zones Total         : ${zones.length}`);
    console.log(`Regions Total       : ${regions.length}`);
    console.log(`Areas Total         : ${areas.length}`);
    console.log(`Territories Input   : ${territories.length}`);

    console.log("===========================================\n");

    return {
      success: true,

      zones: {
        created: createdZones,
        existing: existingZones,
        total: zones.length,
      },

      regions: {
        created: createdRegions,
        existing: existingRegions,
        total: regions.length,
      },

      areas: {
        created: createdAreas,
        existing: existingAreas,
        total: areas.length,
      },

      territories: {
        created: createdTerritories,
        existing: existingTerritories,
        total: territories.length,
      },
    };
  } catch (error) {
    await session.abortTransaction();

    console.error("\n❌ Geography seed failed.");
    console.error(error);

    throw error;
  } finally {
    await session.endSession();
  }
}

export default seedGeography;