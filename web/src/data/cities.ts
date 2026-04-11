// City coordinate lookup [longitude, latitude]
// Keys are lowercase city names (or first part before comma)
const CITIES: Record<string, [number, number]> = {
  // Australia
  'sydney': [151.21, -33.87],
  'melbourne': [144.96, -37.81],
  'brisbane': [153.02, -27.47],
  'perth': [115.86, -31.95],
  'adelaide': [138.60, -34.93],
  'cairns': [145.77, -16.92],
  'gold coast': [153.43, -28.02],
  'darwin': [130.84, -12.46],
  'hobart': [147.33, -42.88],
  'canberra': [149.13, -35.28],
  'alice springs': [133.88, -23.70],
  'port douglas': [145.46, -16.49],
  'broome': [122.23, -17.96],
  'margaret river': [115.08, -33.96],
  'byron bay': [153.62, -28.64],
  'uluru': [131.04, -25.34],
  'great barrier reef': [146.50, -18.00],

  // Japan
  'tokyo': [139.69, 35.68],
  'kyoto': [135.77, 35.01],
  'osaka': [135.50, 34.69],
  'hiroshima': [132.45, 34.39],
  'nara': [135.83, 34.68],
  'sapporo': [141.35, 43.06],
  'fukuoka': [130.42, 33.59],
  'nikko': [139.62, 36.75],
  'hakone': [139.02, 35.23],
  'nagoya': [136.91, 35.18],
  'nagasaki': [129.87, 32.75],
  'kanazawa': [136.63, 36.56],
  'sendai': [140.87, 38.27],
  'yokohama': [139.64, 35.44],
  'kobe': [135.19, 34.69],

  // Thailand
  'bangkok': [100.52, 13.75],
  'phuket': [98.39, 7.89],
  'chiang mai': [98.98, 18.79],
  'koh samui': [100.06, 9.56],
  'krabi': [98.92, 8.09],
  'pattaya': [100.88, 12.93],
  'hua hin': [99.96, 12.57],
  'pai': [98.43, 19.36],
  'chiang rai': [99.83, 19.91],
  'koh phangan': [100.04, 9.74],
  'koh lanta': [99.04, 7.63],

  // Indonesia
  'bali': [115.19, -8.41],
  'denpasar': [115.22, -8.65],
  'ubud': [115.26, -8.51],
  'lombok': [116.32, -8.57],
  'jakarta': [106.85, -6.21],
  'yogyakarta': [110.37, -7.80],
  'komodo': [119.49, -8.57],
  'gili islands': [116.05, -8.35],

  // Singapore
  'singapore': [103.82, 1.35],

  // Malaysia
  'kuala lumpur': [101.69, 3.15],
  'penang': [100.33, 5.41],
  'langkawi': [99.80, 6.35],
  'kota kinabalu': [116.07, 5.98],
  'malacca': [102.25, 2.20],
  'george town': [100.33, 5.41],

  // Vietnam
  'hanoi': [105.85, 21.03],
  'ho chi minh city': [106.66, 10.82],
  'hoi an': [108.33, 15.88],
  'da nang': [108.22, 16.07],
  'halong bay': [107.06, 20.91],
  'nha trang': [109.19, 12.24],
  'hue': [107.59, 16.46],
  'sapa': [103.84, 22.34],
  'phu quoc': [103.96, 10.22],

  // Cambodia
  'siem reap': [103.86, 13.36],
  'phnom penh': [104.92, 11.56],

  // Myanmar
  'yangon': [96.16, 16.85],
  'bagan': [94.86, 21.17],
  'mandalay': [96.08, 21.99],

  // Philippines
  'manila': [120.97, 14.60],
  'cebu': [123.89, 10.32],
  'boracay': [121.93, 11.97],
  'palawan': [118.74, 9.82],
  'el nido': [119.41, 11.18],

  // Hong Kong
  'hong kong': [114.17, 22.31],

  // South Korea
  'seoul': [126.98, 37.57],
  'busan': [129.04, 35.10],
  'jeju': [126.53, 33.49],
  'gyeongju': [129.21, 35.85],

  // China
  'beijing': [116.39, 39.92],
  'shanghai': [121.47, 31.22],
  'shenzhen': [114.06, 22.55],
  "xi'an": [108.93, 34.26],
  'xian': [108.93, 34.26],
  'chengdu': [104.07, 30.67],
  'guilin': [110.29, 25.28],
  'guangzhou': [113.26, 23.13],
  'zhangjiajie': [110.48, 29.12],
  'lijiang': [100.23, 26.86],

  // Taiwan
  'taipei': [121.56, 25.04],

  // Nepal
  'kathmandu': [85.31, 27.72],
  'pokhara': [83.99, 28.21],

  // Sri Lanka
  'colombo': [79.86, 6.92],
  'kandy': [80.64, 7.29],
  'galle': [80.22, 6.03],

  // Maldives
  'maldives': [73.51, 4.18],
  'malé': [73.51, 4.18],
  'male': [73.51, 4.18],

  // India
  'mumbai': [72.88, 19.07],
  'delhi': [77.21, 28.64],
  'new delhi': [77.21, 28.64],
  'goa': [74.01, 15.30],
  'jaipur': [75.79, 26.91],
  'agra': [78.01, 27.17],
  'kolkata': [88.36, 22.56],
  'udaipur': [73.71, 24.57],
  'varanasi': [83.01, 25.34],
  'kerala': [76.27, 10.85],
  'kochi': [76.27, 9.94],
  'hampi': [76.46, 15.34],
  'rishikesh': [78.27, 30.09],
  'pushkar': [74.55, 26.49],

  // Middle East
  'dubai': [55.30, 25.20],
  'abu dhabi': [54.37, 24.45],
  'doha': [51.54, 25.29],
  'muscat': [58.59, 23.59],
  'amman': [35.93, 31.96],
  'petra': [35.44, 30.33],
  'tel aviv': [34.78, 32.08],
  'jerusalem': [35.22, 31.77],
  'beirut': [35.50, 33.89],
  'riyadh': [46.68, 24.69],

  // Africa
  'cape town': [18.42, -33.93],
  'johannesburg': [28.05, -26.20],
  'nairobi': [36.82, -1.29],
  'zanzibar': [39.22, -6.17],
  'marrakech': [-7.99, 31.63],
  'cairo': [31.24, 30.04],
  'luxor': [32.64, 25.69],
  'casablanca': [-7.59, 33.59],
  'accra': [-0.19, 5.56],
  'victoria falls': [25.85, -17.93],
  'serengeti': [34.83, -2.33],
  'maasai mara': [35.18, -1.49],
  'dar es salaam': [39.27, -6.81],
  'fez': [-4.99, 34.03],

  // UK & Ireland
  'london': [-0.12, 51.51],
  'edinburgh': [-3.19, 55.95],
  'dublin': [-6.27, 53.34],
  'glasgow': [-4.25, 55.86],
  'manchester': [-2.24, 53.48],
  'liverpool': [-2.98, 53.41],
  'bath': [-2.36, 51.38],
  'oxford': [-1.26, 51.75],
  'cambridge': [0.12, 52.21],
  'york': [-1.08, 53.96],
  'belfast': [-5.93, 54.60],

  // France
  'paris': [2.35, 48.85],
  'nice': [7.27, 43.71],
  'marseille': [5.37, 43.30],
  'lyon': [4.83, 45.75],
  'bordeaux': [-0.58, 44.84],
  'strasbourg': [7.75, 48.58],
  'mont saint-michel': [-1.51, 48.64],
  'chamonix': [6.87, 45.92],
  'cannes': [7.02, 43.55],

  // Italy
  'rome': [12.49, 41.90],
  'venice': [12.34, 45.44],
  'florence': [11.26, 43.77],
  'milan': [9.19, 45.46],
  'naples': [14.25, 40.84],
  'amalfi coast': [14.60, 40.63],
  'cinque terre': [9.71, 44.13],
  'sicily': [13.58, 37.60],
  'palermo': [13.36, 38.12],
  'bologna': [11.34, 44.50],
  'verona': [10.99, 45.44],

  // Spain
  'barcelona': [2.17, 41.39],
  'madrid': [-3.70, 40.42],
  'seville': [-5.97, 37.38],
  'granada': [-3.60, 37.18],
  'valencia': [-0.38, 39.47],
  'ibiza': [1.43, 38.91],
  'mallorca': [2.65, 39.70],
  'san sebastian': [-1.98, 43.32],
  'bilbao': [-2.93, 43.26],

  // Portugal
  'lisbon': [-9.14, 38.71],
  'porto': [-8.61, 41.15],
  'algarve': [-8.22, 37.10],
  'sintra': [-9.39, 38.79],
  'madeira': [-16.92, 32.76],
  'azores': [-25.65, 37.74],

  // Germany
  'berlin': [13.40, 52.52],
  'munich': [11.58, 48.14],
  'hamburg': [9.99, 53.55],
  'cologne': [6.96, 50.94],
  'frankfurt': [8.68, 50.11],
  'heidelberg': [8.69, 49.40],
  'rothenburg': [10.18, 49.38],
  'dresden': [13.74, 51.05],
  'nuremburg': [11.08, 49.45],
  'nuremberg': [11.08, 49.45],
  'freiburg': [7.85, 47.99],

  // Austria & Switzerland
  'vienna': [16.37, 48.21],
  'salzburg': [13.04, 47.80],
  'hallstatt': [13.65, 47.56],
  'innsbruck': [11.40, 47.27],
  'zurich': [8.54, 47.38],
  'geneva': [6.14, 46.20],
  'interlaken': [7.86, 46.68],
  'lucerne': [8.31, 47.05],
  'bern': [7.45, 46.95],
  'zermatt': [7.75, 46.02],

  // Netherlands & Belgium
  'amsterdam': [4.90, 52.37],
  'rotterdam': [4.48, 51.92],
  'the hague': [4.30, 52.07],
  'bruges': [3.22, 51.21],
  'brussels': [4.35, 50.85],
  'ghent': [3.72, 51.05],

  // Scandinavia
  'copenhagen': [12.57, 55.68],
  'stockholm': [18.07, 59.33],
  'oslo': [10.75, 59.91],
  'helsinki': [24.94, 60.17],
  'reykjavik': [-21.90, 64.13],
  'bergen': [5.32, 60.39],
  'tromso': [18.96, 69.65],
  'gothenburg': [11.97, 57.71],

  // Eastern Europe
  'prague': [14.42, 50.08],
  'budapest': [19.04, 47.50],
  'warsaw': [21.01, 52.23],
  'krakow': [19.94, 50.06],
  'sofia': [23.32, 42.70],
  'bucharest': [26.10, 44.44],
  'tallinn': [24.75, 59.44],
  'riga': [24.11, 56.95],
  'vilnius': [25.28, 54.69],
  'bratislava': [17.11, 48.15],
  'zagreb': [15.97, 45.81],
  'ljubljana': [14.51, 46.05],

  // Greece
  'athens': [23.73, 37.98],
  'santorini': [25.46, 36.39],
  'mykonos': [25.33, 37.45],
  'thessaloniki': [22.94, 40.64],
  'rhodes': [28.24, 36.43],
  'crete': [24.81, 35.24],
  'corfu': [19.92, 39.62],

  // Balkans
  'dubrovnik': [18.09, 42.65],
  'split': [16.44, 43.51],
  'kotor': [18.77, 42.42],
  'tirana': [19.82, 41.33],
  'sarajevo': [18.41, 43.85],

  // Turkey
  'istanbul': [28.98, 41.01],
  'cappadocia': [34.83, 38.65],
  'antalya': [30.71, 36.90],
  'bodrum': [27.42, 37.03],
  'pamukkale': [29.12, 37.92],
  'ephesus': [27.34, 37.94],

  // Russia
  'moscow': [37.62, 55.75],
  'st petersburg': [30.32, 59.95],
  'saint petersburg': [30.32, 59.95],

  // North America - USA
  'new york': [-74.01, 40.71],
  'los angeles': [-118.24, 34.05],
  'san francisco': [-122.42, 37.77],
  'las vegas': [-115.14, 36.17],
  'miami': [-80.19, 25.77],
  'chicago': [-87.63, 41.88],
  'honolulu': [-157.84, 21.31],
  'hawaii': [-157.84, 21.31],
  'seattle': [-122.33, 47.61],
  'washington dc': [-77.04, 38.91],
  'washington': [-77.04, 38.91],
  'boston': [-71.06, 42.36],
  'new orleans': [-90.07, 29.95],
  'nashville': [-86.78, 36.17],
  'denver': [-104.99, 39.74],
  'phoenix': [-112.07, 33.45],
  'san diego': [-117.16, 32.72],
  'portland': [-122.68, 45.52],
  'austin': [-97.74, 30.27],
  'new york city': [-74.01, 40.71],
  'nyc': [-74.01, 40.71],

  // Canada
  'toronto': [-79.38, 43.65],
  'vancouver': [-123.12, 49.28],
  'montreal': [-73.57, 45.50],
  'quebec city': [-71.21, 46.81],
  'calgary': [-114.07, 51.05],
  'banff': [-115.57, 51.18],
  'whistler': [-122.96, 50.12],

  // Mexico & Caribbean
  'cancun': [-86.85, 21.16],
  'mexico city': [-99.13, 19.43],
  'tulum': [-87.46, 20.21],
  'oaxaca': [-96.73, 17.07],
  'guadalajara': [-103.35, 20.67],
  'havana': [-82.38, 23.13],
  'punta cana': [-68.40, 18.58],
  'san juan': [-66.12, 18.47],
  'barbados': [-59.62, 13.19],
  'jamaica': [-77.30, 18.11],
  'belize city': [-88.20, 17.25],

  // Central America
  'costa rica': [-84.08, 9.93],
  'san jose': [-84.08, 9.93],
  'panama city': [-79.52, 8.99],

  // South America
  'buenos aires': [-58.38, -34.60],
  'rio de janeiro': [-43.17, -22.91],
  'sao paulo': [-46.63, -23.55],
  'lima': [-77.04, -12.05],
  'machu picchu': [-72.54, -13.16],
  'cusco': [-71.98, -13.52],
  'cartagena': [-75.51, 10.39],
  'bogota': [-74.07, 4.71],
  'medellin': [-75.57, 6.25],
  'quito': [-78.52, -0.22],
  'santiago': [-70.65, -33.46],
  'valparaiso': [-71.63, -33.05],
  'montevideo': [-56.17, -34.90],
  'ushuaia': [-68.30, -54.80],
  'patagonia': [-68.50, -51.00],
  'galapagos': [-90.97, -0.97],
  'la paz': [-68.15, -16.50],
  'sucre': [-65.26, -19.03],
  'trinidad': [-61.52, 10.65],

  // Pacific
  'auckland': [174.77, -36.85],
  'wellington': [174.78, -41.29],
  'christchurch': [172.64, -43.53],
  'queenstown': [168.66, -45.03],
  'rotorua': [176.25, -38.14],
  'nadi': [177.44, -17.76],
  'fiji': [177.44, -17.76],
  'tahiti': [-149.57, -17.53],
  'papeete': [-149.57, -17.53],
  'samoa': [-171.79, -13.76],
  'tonga': [-175.22, -21.14],
  'vanuatu': [168.32, -17.73],
  'new caledonia': [166.46, -22.26],
  'cook islands': [-159.78, -21.24],
}

export default CITIES
