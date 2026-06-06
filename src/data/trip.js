// ============ TRIP DATA ============
// Built from the background-doc guides (Cap Corse, Bonifacio, Nice).
// YEAR ASSUMPTION: docs give "June 19–23" with no year — using 2026. If wrong,
// change `dates`, `startDate`, each day's `date`, and LoginScreen's date line.
export const TRIP = {
  title: "Corsica & Nice",
  subtitle: "Cap Corse · Bonifacio · Nice",
  dates: "June 19–23, 2026",
  startDate: "2026-06-19", // ISO; used server-side to compute the current trip day
  days: [
    {
      n: 1, date: "Jun 19", weekday: "Fri",
      title: "Arrive Cap Corse",
      route: "Bastia → Macinaggio · Tomino",
      hero: "Land at the very top of Corsica — Genoese watchtowers, vineyards tumbling to the sea, and a panoramic perch above Macinaggio.",
      timeline: [
        ["Midday", "Land at Bastia · pick up the car"],
        ["~40 min", "Drive north up Cap Corse to Tomino"],
        ["Afternoon", "Check in at Hôtel Le Tomino · settle in"],
        ["Late afternoon", "First views over Macinaggio marina & Rogliano"],
        ["Evening", "Dinner on the hotel's panoramic terrace"],
      ],
      activities: {
        hiker: "Short late-afternoon stroll up to Rogliano — castle ruins & sea views",
        biker: "Borrow Le Tomino's e-bikes down to the marina",
        rendezvous: "Sunset & aperitivo on Le Tomino's terrace",
      },
      meals: {
        lunch: "On your own (travel day)",
        dinner: "🍽 Le Tomino — homemade local cooking on the terrace",
      },
    },
    {
      n: 2, date: "Jun 20", weekday: "Sat",
      title: "Cap Corse",
      route: "Macinaggio · Cap Corse loop",
      hero: "The island within the island: the Customs Officers' Trail to hidden coves, then the D80 wine-and-cliffs loop.",
      timeline: [
        ["Early AM", "Sentier des Douaniers from Macinaggio — go early for cool, empty sand"],
        ["Morning", "Tamarone beach & the Santa Maria tower (Finocchiarola islets)"],
        ["Lunch", "Beachside at Tamarone"],
        ["Afternoon", "Drive the D80 loop — Centuri, Nonza, Patrimonio"],
        ["Late afternoon", "Cellar-door tasting around Rogliano / Patrimonio"],
        ["Evening", "Dinner up in Rogliano"],
      ],
      activities: {
        hiker: "Sentier des Douaniers to Tamarone, Cala Genovese & Cala Francese",
        biker: "E-bike the cape's hills to the port, beaches and villages",
        rendezvous: "Cap Corse coves — clearest, calmest water in the morning",
      },
      meals: {
        lunch: "🏖 U Paradisu — beachside at Tamarone bay",
        dinner: "🍷 U Sant'Agnellu — Rogliano terrace with sea views",
      },
    },
    {
      n: 3, date: "Jun 21", weekday: "Sun",
      title: "South to Bonifacio",
      route: "Cap Corse → Bonifacio",
      hero: "The long drive down the island to a white city stacked on white cliffs above a hidden harbour.",
      timeline: [
        ["Morning", "Depart Cap Corse · scenic drive south (~4.5 hrs)"],
        ["Midday", "Lunch stop en route"],
        ["Afternoon", "Check in at Hotel Cala di Greco, clifftop above Bonifacio"],
        ["Late afternoon", "First wander of the Haute Ville citadel"],
        ["Sunset", "Ramparts or the marine cemetery as the light turns gold"],
        ["Evening", "Dinner on the marina"],
      ],
      activities: {
        hiker: "Walk up the ramp into the Haute Ville & along the ramparts",
        biker: null,
        rendezvous: "Sunset on the ramparts / marine cemetery — the photo you'll remember",
      },
      meals: {
        lunch: "🥪 Lunch stop en route (your choice)",
        dinner: "🦞 Le Voilier — seafood on the marina (book ahead)",
      },
    },
    {
      n: 4, date: "Jun 22", weekday: "Mon",
      title: "Bonifacio",
      route: "Bonifacio · Lavezzi Islands",
      hero: "Cliffs, sea caves, and the King of Aragon's 187 steps — then turquoise water at the Lavezzi islands.",
      timeline: [
        ["Morning", "Cliffs-and-caves boat tour — Grain de Sable & the Sdragonato cave"],
        ["Late morning", "King of Aragon's Staircase & Bastion de l'Étendard"],
        ["Midday", "Lunch in the old town"],
        ["Afternoon", "Boat day-trip to the Lavezzi Islands — swim & snorkel"],
        ["Evening", "Corsican home cooking up in the citadel"],
      ],
      activities: {
        hiker: "Pertusato lighthouse path & the clifftop marine cemetery",
        biker: null,
        rendezvous: "Lavezzi Islands — turquoise water & granite coves (book the boat ahead)",
      },
      meals: {
        lunch: "🍆 Cantina Doria — aubergines à la bonifacienne",
        dinner: "🍝 Stella d'Oro — classic Bonifacien in the old town",
      },
    },
    {
      n: 5, date: "Jun 23", weekday: "Tue",
      title: "To Nice",
      route: "Bonifacio → Nice (Côte d'Azur)",
      hero: "Cross to the Riviera: a sun-warmed old town, the Promenade des Anglais, and socca hot off the griddle.",
      timeline: [
        ["Morning", "Travel from Corsica to Nice (ferry, or flight via Figari)"],
        ["Afternoon", "Arrive Nice · settle near Vieux Nice"],
        ["Late afternoon", "Promenade des Anglais & the Castle Hill viewpoint"],
        ["Evening", "Socca at Chez Pipo · dinner in the old town"],
      ],
      activities: {
        hiker: "Climb Castle Hill (Colline du Château) for the best view over the bay",
        biker: null,
        rendezvous: "Cours Saleya market & Place Rossetti in Vieux Nice",
      },
      meals: {
        lunch: "🥖 Pan bagnat or socca en route",
        dinner: "🐟 Old-town Niçois — La Merenda or Le Bistrot d'Antoine",
      },
    },
  ],
};

export const CATEGORY_ICONS = {
  landmark: "🏛️",
  food: "🍷",
  seascape: "⛵",
  wildlife: "🐟",
  people: "👥",
  architecture: "🏰",
  activity: "🥾",
  beach: "🏖️",
};
