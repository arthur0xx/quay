export type Product = {
  sku: string;
  name: string;
  origin: string;
  blurb: string;
  price: string;
  currency: "USD";
  image: string;
  alt: string;
};

export const CATALOG: Product[] = [
  {
    sku: "camera",
    name: "Field Camera",
    origin: "Collector's dock",
    blurb: "A compact rangefinder with brass fittings and a worn leather body. Ships empty, ready for a roll of film.",
    price: "148.00",
    currency: "USD",
    image: "/products/camera.jpg",
    alt: "Vintage field camera on oatmeal linen",
  },
  {
    sku: "bowl",
    name: "Tamegroute Bowl",
    origin: "Drâa Valley",
    blurb: "Thick green glaze that runs and pools. Hand-thrown, slightly irregular, meant for olives or nothing at all.",
    price: "64.00",
    currency: "USD",
    image: "/products/bowl.jpg",
    alt: "Green-glazed Tamegroute ceramic bowl",
  },
  {
    sku: "argan",
    name: "Cold-Press Argan",
    origin: "Essaouira",
    blurb: "Unlabelled amber glass, cork stopper. Culinary-grade oil with a toasted, nutty finish.",
    price: "38.00",
    currency: "USD",
    image: "/products/argan.jpg",
    alt: "Amber glass bottle of argan oil",
  },
  {
    sku: "linen",
    name: "Undyed Throw",
    origin: "Sefrou",
    blurb: "Heavyweight undyed linen, tight weave, unfinished edges left honest. One piece, no pattern.",
    price: "92.00",
    currency: "USD",
    image: "/products/linen.jpg",
    alt: "Folded undyed linen throw",
  },
  {
    sku: "tray",
    name: "Hammered Tray",
    origin: "Fès",
    blurb: "Round unpolished brass, hand-planished so the light catches every dent. Empty on purpose.",
    price: "54.00",
    currency: "USD",
    image: "/products/tray.jpg",
    alt: "Hand-hammered brass tray",
  },
  {
    sku: "notebook",
    name: "Cedar Notebook",
    origin: "Middle Atlas",
    blurb: "Small hardwood cover, linen thread, blank stock. No stamp, no motto.",
    price: "22.00",
    currency: "USD",
    image: "/products/notebook.jpg",
    alt: "Small cedar hardcover notebook",
  },
];

export function productBySku(sku: string) {
  return CATALOG.find((item) => item.sku === sku);
}
