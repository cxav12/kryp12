(() => {
  const placeholder = "/diablo/assets/ui/placeholder/image-unavailable.svg";
  const itemImages = {
    "Ancient's Pledge": "ancients-pledge.png",
    "Call to Arms": "call-to-arms.png",
    "Edge": "edge.png",
    "Enigma": "enigma.png",
    "Grief": "grief.png",
    "Infinity": "infinity.png",
    "Insight": "insight.png",
    "King's Grace": "kings-grace.png",
    "Leaf": "leaf.png",
    "Lore": "lore.png",
    "Pattern": "pattern.png",
    "Phoenix": "phoenix.png",
    "Prudence": "prudence.png",
    "Rain": "rain.png",
    "Spirit": "spirit.png",
    "Stealth": "stealth.png",
    "Strength": "strength.png",
    "Zephyr": "zephyr.png"
  };
  const itemImage = name => itemImages[name] ? `/diablo/assets/game/items/runeword-uniques/${itemImages[name]}` : placeholder;
  const runeImages = new Set(["Vex", "Ral", "Ort", "Tal", "Amn", "Mal", "Ist", "Ohm", "Tir", "Jah", "Ith", "Ber", "Eth", "Lo", "Sol", "Thul"]);
  const runeImage = rune => runeImages.has(rune)
    ? `/diablo/assets/game/runes/runeword-uniques/${rune.toLowerCase()}.png`
    : placeholder;
  const recipes = [
    {name:"Ancient's Pledge",type:"Multi-Type Weapon",runes:["Ral","Ort","Tal"],affixes:["x35% All Damage Multiplier","+35% Cold Resistance","+35% Fire Resistance","+35% Lightning Resistance","+35% Poison Resistance","35% Damage Reduction"]},
    {name:"Call to Arms",type:"Multi-Type Weapon",runes:["Amn","Ral","Mal","Ist","Ohm"],power:"While a Shout is active, gain +5 ranks to all skills, 15% Maximum Life, and 15% Maximum Primary Resource.",affixes:["+(200–250) Weapon Damage","x40% All Damage Multiplier","+40% Attack Speed","+1 to All Skills","+5 to Shout Skills"]},
    {name:"Edge",type:"Multi-Type Weapon",runes:["Tir","Tal","Amn"],affixes:["+15% chance for an extra item from the Purveyor of Curiosities","+(300–360) All Stats","+(4303–5917) Thorns","+35% Attack Speed","+200% Damage to Demons","+200% Damage to Undead","Lucky Hit: Up to a 40% chance to deal 2200–5400 Poisoning damage over 10 seconds"]},
    {name:"Enigma",type:"Chest Armor",runes:["Jah","Ith","Ber"],power:"Evade becomes the Sorcerer Teleport and costs 33 Primary Resource.",affixes:["+(981–1225) Armor","40% Maximum Life","+45% Movement Speed","12.0% Damage Reduction","+2 to All Skills"]},
    {name:"Grief",type:"Multi-Type Weapon",runes:["Eth","Tir","Lo","Mal","Ral"],power:"Direct damage also applies 40% bonus Poisoning damage over 5 seconds.",affixes:["Indestructible","+(750–1000) Weapon Damage","+(30–40)% Attack Speed","+20% Deadly Strike Chance","+100% Damage to Demons","+2 Primary Resource on Kill"]},
    {name:"Holy Thunder",type:"Multi-Type Weapon",runes:["Eth","Ral","Ort","Tal"],power:"Continuously emit Crackling Energy. Enemies hit by it take 20–35% more Holy, Fire, Lightning, and Physical damage from you for 3 seconds.",affixes:["+(94–157) Weapon Damage","x50% All Damage Multiplier","+20% Lucky Hit","+35% Lightning Resistance","+7 to Double Swing"]},
    {name:"Infinity",type:"Multi-Type Weapon",runes:["Ber","Mal","Ber","Ist"],power:"Kills have a 50% chance to cast a rank 20 Sorcerer Chain Lightning. Gain the rank 22 Druid Cyclone Armor passive. Nearby enemies become Vulnerable and take x125% more damage from you.",affixes:["+(230–383) Weapon Damage","+(3662–4400) Maximum Life","35% Movement Speed","x(45–55)% Fire Damage Multiplier","+(100–200) Gold Drop Rate"]},
    {name:"Insight",type:"Multi-Type Weapon",runes:["Ral","Tir","Tal","Sol"],affixes:["+(207–345) Weapon Damage","+(300–360) All Stats","+30 Fury Regeneration","+35% Attack Speed","+(16–46)% Critical Strike Chance","x200% Critical Strike Damage Multiplier"]},
    {name:"King's Grace",type:"Multi-Type Weapon",runes:["Amn","Ral","Thul"],affixes:["+(94–157) Weapon Damage","+(789–948) Life On Hit","x75% All Damage Multiplier","+50% Lucky Hit Chance","+100% Damage to Demons","+100% Damage to Undead"]},
    {name:"Leaf",type:"Staff",runes:["Tir","Ral"],affixes:["20% Resource Generation","+35% Cold Resistance","+(5–15) to Fire Bolt","+10 to Pyromancy Skills","+4 Primary Resource on Kill","+(5–15) to Incinerate"]},
    {name:"Lore",type:"Helm",runes:["Ort","Sol"],affixes:["+(1963–2500) Armor","+25 Maximum Resource","+(2275–2800) Lightning Resistance","10% Damage Reduction","+2 to All Skills","+2 Primary Resource on Kill"]},
    {name:"Pattern",type:"Dagger",runes:["Tal","Ort","Thul"],affixes:["+(86–143) Weapon Damage","+10% All Stats","x50% All Damage Multiplier","+(10–20)% Critical Strike Chance","+(325–400) Resistance to All Elements","Lucky Hit: Up to a 40% chance to deal 1100–2700 Poisoning damage over 10 seconds"]},
    {name:"Phoenix",type:"Multi-Type Weapon",runes:["Vex","Vex","Lo","Jah"],affixes:["+(94–157) Weapon Damage","+(526–632) Life on Kill","x50% All Damage Multiplier","+20% Deadly Strike Chance","Lucky Hit: Up to a 40% chance to deal 1500–2400 Fire Damage"]},
    {name:"Prudence",type:"Chest Armor",runes:["Mal","Tir"],affixes:["Indestructible","+(20–35)% Total Armor","10% Dodge Chance","+500 Resistance to All Elements","10% Damage Reduction","25% Impairment Reduction","+2 Primary Resource on Kill"]},
    {name:"Rain",type:"Chest Armor",runes:["Ort","Mal","Ith"],power:"Lucky Hits can unleash a rank 15 Druid Tornado, with a 15–30% chance. Dodging has a 50% chance to unleash rank 15 Druid Cyclone Armor.",affixes:["+(25–40) Maximum Resource","10% Dodge Chance","35% Lightning Resistance","10% Damage Reduction","+5 to Nature Magic Skills"]},
    {name:"Spirit",type:"Multi-Type Weapon",runes:["Tal","Thul","Ort","Amn"],affixes:["+(94–157) Weapon Damage","+(20–56) Maximum Resource","x50% All Damage Multiplier","+(25–35)% Attack Speed","50% Impairment Reduction","+5 to All Skills"]},
    {name:"Stealth",type:"Chest Armor",runes:["Tal","Eth"],affixes:["+(1831–2200) Maximum Life","15% Resource Generation","+25% Attack Speed","+25% Movement Speed","15% Damage Reduction","25% Impairment Reduction"]},
    {name:"Strength",type:"Multi-Type Weapon",runes:["Amn","Tir"],affixes:["Lucky Hit: Up to a 25% chance to deliver a Crushing Blow","+(94–157) Weapon Damage","+10% Core Stat","+(1831–2200) Maximum Life","+(789–948) Life on Hit","x50% All Damage Multiplier","+2 Primary Resource on Kill"]},
    {name:"Zephyr",type:"Multi-Type Weapon",runes:["Ort","Eth"],affixes:["x125% All Damage Multiplier","+25% Attack Speed","+25% Movement Speed","25.0% Dodge Chance","Lucky Hit: Up to a 40% chance to deal 3000–4000 Lightning Damage","Unleash a Dust Devil whenever you Dodge"]}
  ];
  const escape = window.DiabloSite?.escapeHtml || (value => String(value));
  const runeMarkup = (rune, eager = false) => `<span class="rune-token"><img src="${runeImage(rune)}" alt="${escape(rune)} rune" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} onerror="this.onerror=null;this.src='${placeholder}'"><span>${escape(rune)}</span></span>`;
  document.querySelector('#runeword-grid').innerHTML = recipes.map((recipe, index) => `<article class="panel runeword-card"><section class="runeword-item"><img class="runeword-placeholder" src="${itemImage(recipe.name)}" alt="${itemImages[recipe.name] ? `${escape(recipe.name)} crafted Unique` : `Temporary artwork placeholder for ${escape(recipe.name)}`}" loading="${index === 0 ? 'eager' : 'lazy'}"${index === 0 ? ' fetchpriority="high"' : ''} onerror="this.onerror=null;this.src='${placeholder}'"><div><h2>${escape(recipe.name)}</h2><p>${escape(recipe.type)}</p></div></section><section class="runeword-runes"><h3>Runes</h3><div class="rune-list">${recipe.runes.map(rune => runeMarkup(rune, index === 0)).join('')}</div></section><section class="runeword-effects">${recipe.power ? `<h3>Unique power</h3><p class="runeword-power">${escape(recipe.power)}</p>` : ''}<h3>Guaranteed affixes</h3><ul class="runeword-affixes">${recipe.affixes.map(affix => `<li>${escape(affix)}</li>`).join('')}</ul></section></article>`).join('');
})();
