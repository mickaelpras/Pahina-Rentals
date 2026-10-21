// Starter catalogue and settings. Loaded once, the first time the store is empty.
// Prices are sample prices in PHP — edit them from the admin (Stock / Settings).

export const CATEGORIES = ["chairs", "tables", "tents", "sound", "catering", "kids", "decor"];

export const SEED_ITEMS = [
  {
    id: "monobloc-chair", category: "chairs", price: 10, qty: 300,
    name: { en: "Monobloc chair (white)", tl: "Monobloc na upuan (puti)" },
    unit: { en: "per chair", tl: "bawat upuan" },
    description: { en: "Clean, stackable plastic chairs. Most popular for birthdays and fiestas.", tl: "Malinis at nasasalansan na plastik na upuan. Pinakasikat sa birthday at pista." },
    image: "/img/items/monobloc-chair.svg",
  },
  {
    id: "tiffany-chair", category: "chairs", price: 55, qty: 100,
    name: { en: "Tiffany chair with cushion", tl: "Tiffany chair na may kutson" },
    unit: { en: "per chair", tl: "bawat upuan" },
    description: { en: "Elegant chairs for weddings, debuts and christenings.", tl: "Eleganteng upuan para sa kasal, debut at binyag." },
    image: "/img/items/tiffany-chair.svg",
  },
  {
    id: "round-table", category: "tables", price: 150, qty: 30,
    name: { en: "Round table (seats 8)", tl: "Bilog na mesa (8 katao)" },
    unit: { en: "per table", tl: "bawat mesa" },
    description: { en: "5 ft round table, good for 8 guests.", tl: "5 talampakang bilog na mesa, kasya ang 8 bisita." },
    image: "/img/items/round-table.svg",
  },
  {
    id: "long-table", category: "tables", price: 120, qty: 30,
    name: { en: "Rectangular table (6 ft)", tl: "Parihabang mesa (6 ft)" },
    unit: { en: "per table", tl: "bawat mesa" },
    description: { en: "Folding table for buffets, gifts or guests.", tl: "Natitiklop na mesa para sa buffet, regalo o bisita." },
    image: "/img/items/long-table.svg",
  },
  {
    id: "table-cloth", category: "tables", price: 35, qty: 80,
    name: { en: "Table cloth & cover", tl: "Mantel at pantakip" },
    unit: { en: "per table", tl: "bawat mesa" },
    description: { en: "Washed and ironed. White, cream or colour on request.", tl: "Nilabhan at plantsado. Puti, krema o kulay kapag hiniling." },
    image: "/img/items/table-cloth.svg",
  },
  {
    id: "tent-10x10", category: "tents", price: 1200, qty: 6,
    name: { en: "Party tent 10×10 ft", tl: "Tolda 10×10 ft" },
    unit: { en: "per tent, set-up included", tl: "bawat tolda, kasama ang pagkabit" },
    description: { en: "Shade and rain cover for about 20 guests.", tl: "Silong sa araw at ulan para sa mga 20 bisita." },
    image: "/img/items/tent-10x10.svg",
  },
  {
    id: "tent-20x20", category: "tents", price: 4500, qty: 2,
    name: { en: "Party tent 20×20 ft", tl: "Tolda 20×20 ft" },
    unit: { en: "per tent, set-up included", tl: "bawat tolda, kasama ang pagkabit" },
    description: { en: "Big tent for about 60 guests. We set it up the day before.", tl: "Malaking tolda para sa mga 60 bisita. Ikinakabit namin sa araw bago ang okasyon." },
    image: "/img/items/tent-20x20.svg",
  },
  {
    id: "videoke", category: "sound", price: 1500, qty: 3,
    name: { en: "Videoke machine", tl: "Videoke" },
    unit: { en: "per day, 2 mics + speaker", tl: "bawat araw, 2 mic + speaker" },
    description: { en: "Thousands of OPM and international songs, 2 wireless mics and speaker.", tl: "Libu-libong OPM at banyagang kanta, 2 wireless mic at speaker." },
    image: "/img/items/videoke.svg",
  },
  {
    id: "chafing-dish", category: "catering", price: 200, qty: 20,
    name: { en: "Chafing dish (full size)", tl: "Chafing dish (full size)" },
    unit: { en: "per piece, fuel included", tl: "bawat isa, kasama ang sterno" },
    description: { en: "Keeps your food warm for the whole party.", tl: "Pinapanatiling mainit ang pagkain buong handaan." },
    image: "/img/items/chafing-dish.svg",
  },
  {
    id: "bouncy-castle", category: "kids", price: 3000, qty: 1,
    name: { en: "Bouncy castle (10×10 ft)", tl: "Bouncy castle (10×10 ft)" },
    unit: { en: "per day, with blower", tl: "bawat araw, kasama ang blower" },
    description: { en: "Kids' favourite. Needs a flat area and an electrical outlet.", tl: "Paborito ng mga bata. Kailangan ng patag na lugar at saksakan ng kuryente." },
    image: "/img/items/bouncy-castle.svg",
  },
  {
    id: "deco-birthday", category: "decor", price: 2500, qty: 3,
    name: { en: "Birthday deco kit", tl: "Deco kit pang-birthday" },
    unit: { en: "per set, set-up included", tl: "bawat set, kasama ang pagkabit" },
    description: { en: "Balloon arch, backdrop and name banner. Tell us your theme and colours.", tl: "Balloon arch, backdrop at banner ng pangalan. Sabihin ang tema at kulay." },
    image: "/img/items/deco-birthday.svg",
  },
  {
    id: "deco-pastel", category: "decor", price: 3000, qty: 2,
    name: { en: "Pastel deco kit (christening / debut)", tl: "Pastel deco kit (binyag / debut)" },
    unit: { en: "per set, set-up included", tl: "bawat set, kasama ang pagkabit" },
    description: { en: "Soft pastel backdrop, flowers and table centrepieces.", tl: "Pastel na backdrop, bulaklak at centerpiece sa mesa." },
    image: "/img/items/deco-pastel.svg",
  },
];

export const TOWNS = ["Angono", "Teresa", "Binangonan", "Taytay", "Morong", "Baras", "Tanay", "Antipolo", "Cainta", "Other"];

export const DEFAULT_SETTINGS = {
  businessName: "Pahina Rentals",
  serviceArea: "Angono · Teresa · Rizal",
  contactPhone: "",
  messengerUrl: "",
  gcashName: "",
  gcashNumber: "",
  depositPercent: 30,
  minDeposit: 500,
  bufferDays: 1,      // stock blocked this many days before and after the event (delivery / pick-up)
  holdHours: 48,      // unpaid requests stop holding stock after this
  minLeadDays: 1,     // earliest booking = today + this
  maxDays: 5,         // longest event a customer can book online
  deliveryFees: { Angono: 150, Teresa: 250, Binangonan: 250, Taytay: 350, Morong: 350, Baras: 400, Tanay: 500, Antipolo: 400, Cainta: 450 },
};
