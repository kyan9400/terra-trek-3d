/* The signature route. Shared by the HTML cards and the 3D globe, so the arcs and the copy can never disagree. */

export type City = {
  id: string;
  city: string;
  country: string;
  code: string; // IATA code of the arrival airport
  lat: number;
  lon: number;
  days: string;
  title: string;
  body: string;
  highlights: [string, string, string];
};

export const ROUTE: City[] = [
  {
    id: "reykjavik",
    city: "Reykjavík",
    country: "Iceland",
    code: "KEF",
    lat: 64.15,
    lon: -21.94,
    days: "Days 1–6",
    title: "Start where the plates pull apart.",
    body: "Soak in a geothermal lagoon at midnight, then walk the rift valley at Þingvellir with a geologist who grew up on the farm next door.",
    highlights: ["Rift-valley walk", "Northern-lights watch", "Westfjords fish supper"],
  },
  {
    id: "marrakech",
    city: "Marrakech",
    country: "Morocco",
    code: "RAK",
    lat: 31.63,
    lon: -7.99,
    days: "Days 7–13",
    title: "Lose the map in the medina.",
    body: "A riad behind an unmarked door, a dawn spice run with a third-generation trader, and two nights under canvas in the Agafay hills.",
    highlights: ["Medina at dawn", "Atlas foothill trek", "Desert camp"],
  },
  {
    id: "cape-town",
    city: "Cape Town",
    country: "South Africa",
    code: "CPT",
    lat: -33.92,
    lon: 18.42,
    days: "Days 14–20",
    title: "Two oceans, one table.",
    body: "Climb Lion’s Head for sunrise, cook with a Bo-Kaap family and drive the peninsula to where the Atlantic meets the Indian Ocean.",
    highlights: ["Lion’s Head sunrise", "Bo-Kaap kitchen", "Cape Point drive"],
  },
  {
    id: "kyoto",
    city: "Kyoto",
    country: "Japan",
    code: "KIX",
    lat: 35.01,
    lon: 135.77,
    days: "Days 21–28",
    title: "Quiet hours in an old capital.",
    body: "Walk Fushimi before the crowds, learn to pack a bento with a ryokan chef and take the slow train into the cedar valleys of Kurama.",
    highlights: ["Fushimi at first light", "Ryokan kitchen", "Kurama forest trail"],
  },
  {
    id: "queenstown",
    city: "Queenstown",
    country: "New Zealand",
    code: "ZQN",
    lat: -45.03,
    lon: 168.66,
    days: "Days 29–35",
    title: "Mountains that make you go quiet.",
    body: "Kayak Milford Sound at first light, walk a section of the Routeburn with a local guide and sleep at a high-country sheep station.",
    highlights: ["Milford Sound kayak", "Routeburn day walk", "Sheep-station stay"],
  },
  {
    id: "cusco",
    city: "Cusco",
    country: "Peru",
    code: "CUZ",
    lat: -13.53,
    lon: -71.97,
    days: "Days 36–42",
    title: "Finish above the clouds.",
    body: "Acclimatise in the Sacred Valley, trek the quieter Lares trail with Quechua weavers and reach Machu Picchu on the first morning bus.",
    highlights: ["Sacred Valley", "Lares trail", "Machu Picchu at opening"],
  },
];

const EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: City, b: City) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Rough block time: cruise at ~840 km/h plus 35 minutes for taxi, climb and descent. */
export function flightTime(km: number) {
  const minutes = Math.round((km / 840) * 60 + 35);
  const h = Math.floor(minutes / 60);
  const m = Math.round((minutes % 60) / 5) * 5;
  return `${h} h ${String(m === 60 ? 55 : m).padStart(2, "0")} m`;
}

export const formatKm = (km: number) => `${Math.round(km / 10) * 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " km";

export function formatCoord(lat: number, lon: number) {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${f(lat, "N", "S")} ${f(lon, "E", "W")}`;
}

export const LEGS = ROUTE.slice(1).map((to, i) => {
  const from = ROUTE[i];
  const km = distanceKm(from, to);
  return { from, to, km, time: flightTime(km) };
});

export const TOTAL_KM = LEGS.reduce((sum, leg) => sum + leg.km, 0);
