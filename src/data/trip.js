// ============ TRIP DATA ============
// NOTE: Dates, boat name, and some specifics are PLACEHOLDERS — see SETUP.md.
// Edit freely; this is a researched draft itinerary, not a confirmed booking.
export const TRIP = {
  title: "Corsica & Nice",
  subtitle: "Côte d'Azur ⇄ Corsica",
  dates: "Sep 5–12, 2026",
  startDate: "2026-09-05", // ISO; used server-side to compute the current trip day
  days: [
    {
      n: 1, date: "Sep 5", weekday: "Sat",
      title: "Embarkation · Nice",
      route: "Nice → overnight crossing",
      hero: "Board on the Côte d'Azur, toast with a Provence rosé, and slip across to Corsica overnight.",
      timeline: [
        ["Afternoon", "Arrive Nice · transfer to the port"],
        ["4–6 PM", "Board · welcome aperitif · safety briefing"],
        ["6 PM", "Cast off · Baie des Anges sail-by at golden hour"],
        ["Evening", "Niçois welcome dinner aboard"],
        ["Overnight", "~95 nm crossing to Calvi (Corsica)"],
      ],
      activities: {
        hiker: null,
        biker: null,
        rendezvous: "Settle in · sunset drinks on the aft deck",
      },
      meals: {
        lunch: "On your own (travel day)",
        dinner: "🥖 Niçois welcome — socca, pissaladière, salade niçoise",
      },
    },
    {
      n: 2, date: "Sep 6", weekday: "Sun",
      title: "Calvi",
      route: "→ Calvi",
      hero: "A Genoese citadel over a crescent of sand and pines — and a Michelin welcome to Corsica.",
      timeline: [
        ["~8 AM", "Landfall at Calvi · breakfast in the bay"],
        ["Morning", "Citadel & ramparts · Notre-Dame de la Serra viewpoint"],
        ["Midday", "Anchor off the pine-backed beach · swim & water toys"],
        ["Afternoon", "Charcuterie & Patrimonio tasting aboard"],
        ["Evening", "Tender ashore for La Signoria ★"],
      ],
      activities: {
        hiker: "Climb to Notre-Dame de la Serra for the gulf panorama",
        biker: "Pine-forest path along the Calvi beach toward Calenzana",
        rendezvous: "Calvi citadel — Genoese ramparts over the marina",
      },
      meals: {
        lunch: "🧀 Corsican charcuterie & brocciu (aboard)",
        dinner: "⭐ La Signoria — Michelin dining outside Calvi",
      },
      featured: "⭐ MICHELIN WELCOME",
    },
    {
      n: 3, date: "Sep 7", weekday: "Mon",
      title: "Scandola & the Calanques",
      route: "Calvi → Scandola → Girolata",
      hero: "Red porphyry cliffs plunging into turquoise, sea caves, and a village reachable only by boat.",
      timeline: [
        ["Early AM", "Cruise south to the Scandola reserve (UNESCO)"],
        ["Morning", "Tender among the red cliffs & sea caves (no landing in the core)"],
        ["Midday", "Anchor at Girolata · swim in glass-clear water"],
        ["Lunch", "Fresh fish & vegetables aboard"],
        ["Afternoon", "Drift the Calanques de Piana · ochre rock spires"],
        ["Evening", "Dinner aboard under the cliffs"],
      ],
      activities: {
        hiker: "Girolata — walk the Sentier du facteur from Col de la Croix",
        biker: "Rest day — Scandola is sea-and-tender country",
        rendezvous: "Girolata bay — fort-topped hamlet, no road in",
      },
      meals: {
        lunch: "🐟 Catch of the day & garden vegetables (aboard)",
        dinner: "🌅 Chef's table aboard at anchor",
      },
    },
    {
      n: 4, date: "Sep 8", weekday: "Tue",
      title: "Ajaccio",
      route: "Girolata → Cargèse → Ajaccio",
      hero: "Greek-Corsican villages, Napoleon's hometown, and the Sanguinaires islands ablaze at sunset.",
      timeline: [
        ["Early AM", "Coastal cruise south · pass Cargèse (Greek heritage)"],
        ["Midday", "Enter the mountain-ringed Gulf of Ajaccio"],
        ["Afternoon", "Old town · Maison Bonaparte · market"],
        ["Late afternoon", "Reposition toward the Îles Sanguinaires"],
        ["Sunset", "The 'blood-red' islands at golden hour"],
        ["Evening", "Seafood dinner · Ajaccio AOC wine"],
      ],
      activities: {
        hiker: "Pointe de la Parata — tower walk over the Sanguinaires",
        biker: "Route des Sanguinaires along the gulf shore",
        rendezvous: "Îles Sanguinaires for sunset",
      },
      meals: {
        lunch: "🥗 Light Mediterranean (underway)",
        dinner: "🍲 Aziminu (Corsican bouillabaisse) aboard",
      },
    },
    {
      n: 5, date: "Sep 9", weekday: "Wed",
      title: "Bonifacio",
      route: "Ajaccio → Bonifacio",
      hero: "A white city teetering on chalk cliffs above a fjord-like harbour — Corsica's most dramatic port.",
      timeline: [
        ["Early AM", "Cruise to Corsica's southern tip"],
        ["Morning", "Approach the chalk cliffs & enter the hidden harbour"],
        ["Midday", "Haute Ville citadel · Escalier du Roi d'Aragon"],
        ["Afternoon", "Swim in the Bouches de Bonifacio"],
        ["Evening", "Tender ashore for Finestra by Italo Bassi ★"],
      ],
      activities: {
        hiker: "Coastal path to the Pertusato lighthouse",
        biker: "Citadel ramparts on foot — bikes rest today",
        rendezvous: "Bouches de Bonifacio — strait between Corsica & Sardinia",
      },
      meals: {
        lunch: "🍆 Aubergines à la bonifacienne (aboard)",
        dinner: "⭐ Finestra by Italo Bassi — Bonifacio",
      },
      featured: "⭐ MICHELIN DINNER",
    },
    {
      n: 6, date: "Sep 10", weekday: "Thu",
      title: "Lavezzi & Porto-Vecchio",
      route: "Bonifacio → Lavezzi → Porto-Vecchio",
      hero: "Granite-and-turquoise island swimming, then the powder-white sands of Palombaggia.",
      timeline: [
        ["Early AM", "Short hop to the Îles Lavezzi nature reserve"],
        ["Morning", "Snorkel the granite coves · the clearest water of the trip"],
        ["Midday", "Cruise up to Palombaggia / Santa Giulia"],
        ["Afternoon", "Beach time · paddleboards · anchor off Porto-Vecchio"],
        ["Evening", "Michelin finale ashore"],
      ],
      activities: {
        hiker: "Beach walk along Palombaggia's pink granite & umbrella pines",
        biker: "Flat coastal lanes behind Santa Giulia",
        rendezvous: "Îles Lavezzi — granite boulders & hidden calas",
      },
      meals: {
        lunch: "🍤 Crudo & grilled prawns after the swim (aboard)",
        dinner: "⭐⭐ Casadelmar — Porto-Vecchio",
      },
      featured: "⭐ MICHELIN FINALE",
    },
    {
      n: 7, date: "Sep 11", weekday: "Fri",
      title: "Return Passage · Îles de Lérins",
      route: "Porto-Vecchio → Îles de Lérins",
      hero: "A long blue passage back to the Riviera, ending at the monks' islands off Cannes.",
      timeline: [
        ["Early AM", "Depart Corsica · open-water passage north"],
        ["Underway", "Sea day — sundeck, water toys at a midday drift-stop"],
        ["Late afternoon", "Anchor off the Îles de Lérins (Cannes)"],
        ["Evening", "Farewell Corsican feast aboard"],
      ],
      activities: {
        hiker: "Île Saint-Honorat — walk the monastery vineyard loop",
        biker: "Rest / passage day",
        rendezvous: "Île Sainte-Marguerite — pine paths & the Man in the Iron Mask fort",
      },
      meals: {
        lunch: "🥪 Pan bagnat & rosé (underway)",
        dinner: "🐗 Farewell feast — wild boar civet, fiadone",
      },
    },
    {
      n: 8, date: "Sep 12", weekday: "Sat",
      title: "Disembark · Nice",
      route: "Îles de Lérins → Nice",
      hero: "A last Riviera morning, then ashore in Nice by noon.",
      timeline: [
        ["~7 AM", "Weigh anchor · short cruise toward Nice"],
        ["Underway", "Breakfast on the aft deck · the coast slides by"],
        ["~10 AM", "Arrive Nice · settle accounts · tip envelopes"],
        ["12:00 PM", "Disembark by noon"],
      ],
      activities: {
        hiker: null,
        biker: null,
        rendezvous: "Disembark at Nice by noon",
      },
      meals: {
        lunch: "On your own (post-disembark)",
        dinner: "—",
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
