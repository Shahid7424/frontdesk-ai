import type { BusinessKnowledge } from "../src/agent";

export const clinic: BusinessKnowledge = {
  id: "b1",
  slug: "sunrise-clinic",
  name: "Sunrise Family Clinic",
  vertical: "clinic",
  area: "Baner, Pune",
  address: "Baner Road",
  phone: null,
  staff: [
    { id: "mehta", name: "Dr. Anjali Mehta", title: "General Physician" },
    { id: "kulkarni", name: "Dr. Rohan Kulkarni", title: "Pulmonologist" },
  ],
  services: [
    { id: "gp", name: "General consultation", durationMin: 15, pricePaise: 50000, staffIds: ["mehta"] },
    { id: "chest", name: "Chest consultation", durationMin: 20, pricePaise: 80000, staffIds: ["kulkarni"] },
  ],
  hours: [
    ...[1, 2, 3, 4, 5, 6].flatMap((weekday) => [
      { weekday, start: "09:00", end: "13:30", staffId: null },
      { weekday, start: "17:00", end: "21:00", staffId: null },
    ]),
    { weekday: 0, start: "10:00", end: "13:00", staffId: "mehta" },
  ],
};
