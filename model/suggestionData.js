const suggestions = {
  travel: {
    captions: [
      "Not all those who wander are lost 🌍",
      "Adventure awaits, go find it ✈️",
      "Collect moments, not things 📸",
      "Life is short and the world is wide 🗺️",
      "Wander often, wonder always 🌄"
    ],
    hashtags: [
      "#travel", "#wanderlust", "#travelgram",
      "#exploretheworld", "#adventure", "#travelphotography",
      "#traveldiaries", "#instatravel", "#roamtheplanet"
    ],
    songs: [
      { title: "Wake Me Up – Avicii", mood: "uplifting" },
      { title: "A Sky Full of Stars – Coldplay", mood: "cinematic" },
      { title: "Sunflower – Post Malone", mood: "chill" },
      { title: "Good Life – OneRepublic", mood: "feel-good" },
      { title: "On Top of the World – Imagine Dragons", mood: "euphoric" }
    ]
  },
 
  fitness: {
    captions: [
      "Sweat now, shine later 💪",
      "Your only limit is you 🔥",
      "Train insane or remain the same",
      "The body achieves what the mind believes 🧠",
      "Push yourself because no one else is going to do it for you 🏋️"
    ],
    hashtags: [
      "#fitness", "#gym", "#workout",
      "#fitnessmotivation", "#grind", "#gains",
      "#fitlife", "#nopainnogain", "#bodybuilding"
    ],
    songs: [
      { title: "Stronger – Kanye West", mood: "hype" },
      { title: "Till I Collapse – Eminem", mood: "intense" },
      { title: "Eye of the Tiger – Survivor", mood: "classic" },
      { title: "Power – Kanye West", mood: "dominant" },
      { title: "Can't Hold Us – Macklemore", mood: "energetic" }
    ]
  },
 
  fashion: {
    captions: [
      "Style is a way to say who you are 👗",
      "Dress like you're already famous ✨",
      "Fashion fades, style is eternal",
      "Life is too short to wear boring clothes 🌈",
      "Outfit of the day: confidence 💅"
    ],
    hashtags: [
      "#fashion", "#ootd", "#style",
      "#outfitoftheday", "#aesthetic", "#fashionista",
      "#streetstyle", "#lookbook", "#fashionblogger"
    ],
    songs: [
      { title: "Vogue – Madonna", mood: "iconic" },
      { title: "7 rings – Ariana Grande", mood: "confident" },
      { title: "Fancy – Iggy Azalea", mood: "glam" },
      { title: "Boss Bitch – Doja Cat", mood: "fierce" },
      { title: "Formation – Beyoncé", mood: "powerful" }
    ]
  },
 
  tech: {
    captions: [
      "Building the future, one line at a time 💻",
      "Code is poetry 🧠",
      "Ship it. Iterate. Repeat 🚀",
      "In a world full of users, be a developer 👨‍💻",
      "First, solve the problem. Then, write the code 🛠️"
    ],
    hashtags: [
      "#tech", "#coding", "#developer",
      "#buildinpublic", "#100daysofcode", "#programming",
      "#webdev", "#softwareengineer", "#opensource"
    ],
    songs: [
      { title: "Harder Better Faster Stronger – Daft Punk", mood: "focus" },
      { title: "Interstellar OST – Hans Zimmer", mood: "deep work" },
      { title: "Lose Yourself – Eminem", mood: "grind" },
      { title: "The Less I Know The Better – Tame Impala", mood: "flow state" },
      { title: "Levels – Avicii", mood: "productive" }
    ]
  },
 
  aesthetic: {
    captions: [
      "Soft life, big dreams 🌸",
      "In my own world and it's beautiful 🕊️",
      "Living slowly, loving deeply",
      "She believed she could, so she did 🌙",
      "Bloom where you are planted 🌷"
    ],
    hashtags: [
      "#aesthetic", "#softlife", "#vibes",
      "#aestheticphotos", "#minimalvibes", "#moodboard",
      "#dreamy", "#cottagecore", "#coquette"
    ],
    songs: [
      { title: "Golden Hour – JVKE", mood: "dreamy" },
      { title: "Sweater Weather – The Neighbourhood", mood: "cozy" },
      { title: "Cruel Summer – Taylor Swift", mood: "nostalgic" },
      { title: "Espresso – Sabrina Carpenter", mood: "girly pop" },
      { title: "Die With A Smile – Lady Gaga & Bruno Mars", mood: "romantic" }
    ]
  },
 
  food: {
    captions: [
      "Good food, good mood 🍜",
      "First, we eat. Then, we do everything else 🍕",
      "Life is too short for bad coffee ☕",
      "Eating my feelings, one bite at a time 🍰",
      "Food is my love language 🥘"
    ],
    hashtags: [
      "#foodie", "#foodphotography", "#instafood",
      "#foodblogger", "#yummy", "#foodstagram",
      "#homecooking", "#foodlover", "#delicious"
    ],
    songs: [
      { title: "Happy – Pharrell Williams", mood: "upbeat" },
      { title: "Sunday Morning – Maroon 5", mood: "brunch vibes" },
      { title: "Peaches – Justin Bieber", mood: "fruity & fun" },
      { title: "Good Day Sunshine – The Beatles", mood: "feel-good" },
      { title: "Butter – BTS", mood: "smooth" }
    ]
  },
 
  motivation: {
    captions: [
      "Start where you are. Use what you have. Do what you can 🌟",
      "Every day is a second chance 💫",
      "Dream bigger. Do better. Become more 🚀",
      "The comeback is always stronger than the setback 💪",
      "Small steps every day lead to big results 🎯"
    ],
    hashtags: [
      "#motivation", "#mindset", "#grindset",
      "#success", "#hustle", "#inspire",
      "#growth", "#selfdevelopment", "#dailymotivation"
    ],
    songs: [
      { title: "Hall of Fame – The Script ft. will.i.am", mood: "inspirational" },
      { title: "Believer – Imagine Dragons", mood: "empowering" },
      { title: "Rise – Katy Perry", mood: "triumphant" },
      { title: "Not Afraid – Eminem", mood: "courageous" },
      { title: "Unstoppable – Sia", mood: "fearless" }
    ]
 const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion;

 
