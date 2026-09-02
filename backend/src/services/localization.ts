import { SupportedLanguageCode } from "../types/language.js";

/**
 * Canned phrase templates used by the MockAIProvider (no OpenAI key
 * configured) so the demo remains fully functional offline, and by the
 * real provider's system prompt to instruct it which language to reply in.
 */
type Phrases = {
  languageName: string;
  greeting: string;
  foundProduct: (name: string, brand: string, qty: string, price: number) => string;
  priceInfo: (name: string, brand: string, packQty: string, price: number) => string;
  priceForQuantity: (name: string, brand: string, packQty: string, price: number, qtyLabel: string, total: number) => string;
  stockInfo: (name: string, stock: number, unitLabel: string) => string;
  notFound: (query: string) => string;
  outOfStock: (name: string) => string;
  insufficientStock: (name: string, stock: number) => string;
  addedToCart: (qty: number, name: string, lineTotal: number) => string;
  quantityUpdated: (qty: number, name: string, lineTotal: number) => string;
  itemRemoved: (name: string) => string;
  askWhichProduct: (options: string) => string;
  askWhichProductAndQuantity: (options: string) => string;
  askQuantity: (name: string, unitLabel: string) => string;
  offerAvailableInstead: (name: string, stock: number) => string;
  confirmationCancelled: string;
  /** One line per cart item, e.g. "- 2 kg of India Gate Basmati Rice (₹324)". */
  cartItemLine: (qty: number, unit: string, name: string, lineTotal: number) => string;
  /** Full cart-contents answer: item count, the joined item lines, and the subtotal. Never invents item data — callers must build itemLines from the real get_cart result. */
  cartSummary: (count: number, itemLines: string, subtotal: number) => string;
  emptyCart: string;
  orderPlaced: (orderId: string, total: number, eta: number) => string;
  orderStatus: (orderId: string, status: string) => string;
  orderNotFound: (orderId: string) => string;
  orderCancelled: (orderId: string) => string;
  genericHelp: string;
};

export const PHRASES: Record<SupportedLanguageCode, Phrases> = {
  en: {
    languageName: "English",
    greeting: "Hi! I'm the GroceryNxt voice assistant. What would you like to order today?",
    foundProduct: (name, brand, qty, price) => `I found ${brand} ${name} (${qty}) for ₹${price}.`,
    priceInfo: (name, brand, packQty, price) => `${brand} ${name} is ₹${price} per ${packQty}.`,
    priceForQuantity: (name, brand, packQty, price, qtyLabel, total) =>
      `${brand} ${name} is ₹${price} per ${packQty}. For ${qtyLabel}, it would be ₹${total}.`,
    stockInfo: (name, stock, unitLabel) => `${name} has ${stock}${unitLabel ? ` ${unitLabel}` : ""} available.`,
    notFound: (q) => `Sorry, I couldn't find anything matching "${q}" in our catalog.`,
    outOfStock: (name) => `${name} is currently out of stock.`,
    insufficientStock: (name, stock) => `Sorry, only ${stock} units of ${name} are available right now.`,
    addedToCart: (qty, name, lineTotal) => `Added ${qty} x ${name} to your cart (₹${lineTotal}).`,
    quantityUpdated: (qty, name, lineTotal) => `Sure, I've updated your ${name} quantity to ${qty}. The total is ₹${lineTotal}.`,
    itemRemoved: (name) => `Okay, I've removed ${name} from your cart.`,
    askWhichProduct: (options) => `We have ${options}. Which one would you like?`,
    askWhichProductAndQuantity: (options) => `We have ${options}. Which one would you like, and how much?`,
    askQuantity: (name, unitLabel) => `How many ${unitLabel} of ${name} would you like?`,
    offerAvailableInstead: (name, stock) => `Sorry, only ${stock} ${name} available right now. Would you like ${stock} instead?`,
    confirmationCancelled: "No problem — let me know if you'd like anything else.",
    cartItemLine: (qty, unit, name, lineTotal) => `${qty} ${unit} of ${name} (₹${lineTotal})`,
    cartSummary: (count, itemLines, subtotal) => `You have ${count} item(s) in your cart: ${itemLines}. Your subtotal is ₹${subtotal}.`,
    emptyCart: "Your cart is empty.",
    orderPlaced: (orderId, total, eta) => `Your order ${orderId} has been placed for ₹${total}. Estimated delivery in ${eta} minutes.`,
    orderStatus: (orderId, status) => `Order ${orderId} is currently "${status}".`,
    orderNotFound: (orderId) => `I couldn't find an order with ID ${orderId}.`,
    orderCancelled: (orderId) => `Order ${orderId} has been cancelled.`,
    genericHelp: "You can ask me to find products, add items to your cart, or place an order.",
  },
  hi: {
    languageName: "Hindi",
    greeting: "नमस्ते! मैं GroceryNxt वॉइस असिस्टेंट हूँ। आज आप क्या ऑर्डर करना चाहेंगे?",
    foundProduct: (name, brand, qty, price) => `मुझे ${brand} ${name} (${qty}) ₹${price} में मिला।`,
    priceInfo: (name, brand, packQty, price) => `${brand} ${name} की कीमत ₹${price} प्रति ${packQty} है।`,
    priceForQuantity: (name, brand, packQty, price, qtyLabel, total) =>
      `${brand} ${name} की कीमत ₹${price} प्रति ${packQty} है। ${qtyLabel} के लिए, यह ₹${total} होगा।`,
    stockInfo: (name, stock, unitLabel) => `${name} के ${stock}${unitLabel ? ` ${unitLabel}` : ""} उपलब्ध हैं।`,
    notFound: (q) => `माफ़ कीजिए, "${q}" से मिलता कोई प्रोडक्ट नहीं मिला।`,
    outOfStock: (name) => `${name} अभी स्टॉक में नहीं है।`,
    insufficientStock: (name, stock) => `माफ़ कीजिए, अभी सिर्फ ${stock} यूनिट ${name} उपलब्ध हैं।`,
    addedToCart: (qty, name, lineTotal) => `${qty} x ${name} आपके कार्ट में जोड़ दिया गया (₹${lineTotal})।`,
    quantityUpdated: (qty, name, lineTotal) => `ठीक है, ${name} की मात्रा ${qty} कर दी गई है। कुल ₹${lineTotal} है।`,
    itemRemoved: (name) => `ठीक है, ${name} को आपके कार्ट से हटा दिया गया है।`,
    askWhichProduct: (options) => `हमारे पास ये विकल्प हैं: ${options}। आपको कौन सा चाहिए?`,
    askWhichProductAndQuantity: (options) => `हमारे पास ये विकल्प हैं: ${options}। आपको कौन सा चाहिए, और कितना?`,
    askQuantity: (name, unitLabel) => `आपको ${name} कितने ${unitLabel} चाहिए?`,
    offerAvailableInstead: (name, stock) => `माफ़ कीजिए, अभी सिर्फ ${stock} ${name} उपलब्ध हैं। क्या आपको ${stock} चाहिए?`,
    confirmationCancelled: "ठीक है, अगर कुछ और चाहिए तो बताइए।",
    cartItemLine: (qty, unit, name, lineTotal) => `${name} की ${qty} ${unit} (₹${lineTotal})`,
    cartSummary: (count, itemLines, subtotal) => `आपके कार्ट में ${count} आइटम हैं: ${itemLines}। आपका कुल ₹${subtotal} है।`,
    emptyCart: "आपका कार्ट खाली है।",
    orderPlaced: (orderId, total, eta) => `आपका ऑर्डर ${orderId}, ₹${total} में दर्ज हो गया है। डिलीवरी लगभग ${eta} मिनट में होगी।`,
    orderStatus: (orderId, status) => `ऑर्डर ${orderId} अभी "${status}" स्थिति में है।`,
    orderNotFound: (orderId) => `${orderId} आईडी वाला कोई ऑर्डर नहीं मिला।`,
    orderCancelled: (orderId) => `ऑर्डर ${orderId} रद्द कर दिया गया है।`,
    genericHelp: "आप मुझसे प्रोडक्ट खोजने, कार्ट में जोड़ने या ऑर्डर देने के लिए कह सकते हैं।",
  },
  ta: {
    languageName: "Tamil",
    greeting: "வணக்கம்! நான் GroceryNxt குரல் உதவியாளர். இன்று என்ன ஆர்டர் செய்ய விரும்புகிறீர்கள்?",
    foundProduct: (name, brand, qty, price) => `${brand} ${name} (${qty}) ₹${price} விலையில் கிடைத்தது.`,
    priceInfo: (name, brand, packQty, price) => `${brand} ${name} விலை ஒரு ${packQty}க்கு ₹${price}.`,
    priceForQuantity: (name, brand, packQty, price, qtyLabel, total) =>
      `${brand} ${name} விலை ஒரு ${packQty}க்கு ₹${price}. ${qtyLabel}க்கு, அது ₹${total} ஆகும்.`,
    stockInfo: (name, stock, unitLabel) => `${name} க்கு ${stock}${unitLabel ? ` ${unitLabel}` : ""} கையிருப்பில் உள்ளது.`,
    notFound: (q) => `மன்னிக்கவும், "${q}" க்கு பொருந்தும் பொருள் கிடைக்கவில்லை.`,
    outOfStock: (name) => `${name} தற்போது கையிருப்பில் இல்லை.`,
    insufficientStock: (name, stock) => `மன்னிக்கவும், தற்போது ${stock} யூனிட் ${name} மட்டுமே உள்ளது.`,
    addedToCart: (qty, name, lineTotal) => `${qty} x ${name} உங்கள் கார்ட்டில் சேர்க்கப்பட்டது (₹${lineTotal}).`,
    quantityUpdated: (qty, name, lineTotal) => `சரி, ${name} அளவை ${qty} ஆக மாற்றிவிட்டேன். மொத்தம் ₹${lineTotal}.`,
    itemRemoved: (name) => `சரி, ${name} உங்கள் கார்ட்டிலிருந்து அகற்றப்பட்டது.`,
    askWhichProduct: (options) => `எங்களிடம் இந்த விருப்பங்கள் உள்ளன: ${options}. உங்களுக்கு எது வேண்டும்?`,
    askWhichProductAndQuantity: (options) => `எங்களிடம் இந்த விருப்பங்கள் உள்ளன: ${options}. உங்களுக்கு எது வேண்டும், எவ்வளவு வேண்டும்?`,
    askQuantity: (name, unitLabel) => `உங்களுக்கு ${name} எத்தனை ${unitLabel} வேண்டும்?`,
    offerAvailableInstead: (name, stock) => `மன்னிக்கவும், தற்போது ${stock} ${name} மட்டுமே உள்ளது. உங்களுக்கு ${stock} வேண்டுமா?`,
    confirmationCancelled: "பரவாயில்லை, வேறு ஏதாவது வேண்டுமெனில் சொல்லுங்கள்.",
    cartItemLine: (qty, unit, name, lineTotal) => `${name} ${qty} ${unit} (₹${lineTotal})`,
    cartSummary: (count, itemLines, subtotal) => `உங்கள் கார்ட்டில் ${count} பொருட்கள் உள்ளன: ${itemLines}. மொத்தம் ₹${subtotal}.`,
    emptyCart: "உங்கள் கார்ட் காலியாக உள்ளது.",
    orderPlaced: (orderId, total, eta) => `உங்கள் ஆர்டர் ${orderId}, ₹${total} க்கு பதிவு செய்யப்பட்டது. சுமார் ${eta} நிமிடங்களில் டெலிவரி ஆகும்.`,
    orderStatus: (orderId, status) => `ஆர்டர் ${orderId} தற்போது "${status}" நிலையில் உள்ளது.`,
    orderNotFound: (orderId) => `${orderId} என்ற ஆர்டர் கிடைக்கவில்லை.`,
    orderCancelled: (orderId) => `ஆர்டர் ${orderId} ரத்து செய்யப்பட்டது.`,
    genericHelp: "பொருட்களைத் தேட, கார்ட்டில் சேர்க்க, அல்லது ஆர்டர் செய்ய என்னிடம் கேளுங்கள்.",
  },
  te: {
    languageName: "Telugu",
    greeting: "నమస్కారం! నేను GroceryNxt వాయిస్ అసిస్టెంట్‌ని. ఈరోజు మీరు ఏమి ఆర్డర్ చేయాలనుకుంటున్నారు?",
    foundProduct: (name, brand, qty, price) => `${brand} ${name} (${qty}) ₹${price}కి దొరికింది.`,
    priceInfo: (name, brand, packQty, price) => `${brand} ${name} ధర ఒక ${packQty}కి ₹${price}.`,
    priceForQuantity: (name, brand, packQty, price, qtyLabel, total) =>
      `${brand} ${name} ధర ఒక ${packQty}కి ₹${price}. ${qtyLabel}కి, అది ₹${total} అవుతుంది.`,
    stockInfo: (name, stock, unitLabel) => `${name} కి ${stock}${unitLabel ? ` ${unitLabel}` : ""} నిల్వ ఉంది.`,
    notFound: (q) => `క్షమించండి, "${q}" కి సరిపోలే ఉత్పత్తి కనబడలేదు.`,
    outOfStock: (name) => `${name} ప్రస్తుతం స్టాక్‌లో లేదు.`,
    insufficientStock: (name, stock) => `క్షమించండి, ప్రస్తుతం ${stock} యూనిట్లు ${name} మాత్రమే అందుబాటులో ఉన్నాయి.`,
    addedToCart: (qty, name, lineTotal) => `${qty} x ${name} మీ కార్ట్‌కి జోడించబడింది (₹${lineTotal}).`,
    quantityUpdated: (qty, name, lineTotal) => `సరే, ${name} పరిమాణాన్ని ${qty}కి మార్చాను. మొత్తం ₹${lineTotal}.`,
    itemRemoved: (name) => `సరే, ${name} మీ కార్ట్ నుండి తీసివేయబడింది.`,
    askWhichProduct: (options) => `మా వద్ద ఈ ఎంపికలు ఉన్నాయి: ${options}. మీకు ఏది కావాలి?`,
    askWhichProductAndQuantity: (options) => `మా వద్ద ఈ ఎంపికలు ఉన్నాయి: ${options}. మీకు ఏది కావాలి, ఎంత కావాలి?`,
    askQuantity: (name, unitLabel) => `మీకు ${name} ఎన్ని ${unitLabel} కావాలి?`,
    offerAvailableInstead: (name, stock) => `క్షమించండి, ప్రస్తుతం ${stock} ${name} మాత్రమే ఉంది. మీకు ${stock} కావాలా?`,
    confirmationCancelled: "పర్వాలేదు, ఇంకేమైనా కావాలంటే చెప్పండి.",
    cartItemLine: (qty, unit, name, lineTotal) => `${name} ${qty} ${unit} (₹${lineTotal})`,
    cartSummary: (count, itemLines, subtotal) => `మీ కార్ట్‌లో ${count} వస్తువులు ఉన్నాయి: ${itemLines}. మొత్తం ₹${subtotal}.`,
    emptyCart: "మీ కార్ట్ ఖాళీగా ఉంది.",
    orderPlaced: (orderId, total, eta) => `మీ ఆర్డర్ ${orderId}, ₹${total}కి నమోదైంది. దాదాపు ${eta} నిమిషాల్లో డెలివరీ అవుతుంది.`,
    orderStatus: (orderId, status) => `ఆర్డర్ ${orderId} ప్రస్తుతం "${status}" స్థితిలో ఉంది.`,
    orderNotFound: (orderId) => `${orderId} అనే ఆర్డర్ కనబడలేదు.`,
    orderCancelled: (orderId) => `ఆర్డర్ ${orderId} రద్దు చేయబడింది.`,
    genericHelp: "ఉత్పత్తులను వెతకడానికి, కార్ట్‌కి జోడించడానికి, లేదా ఆర్డర్ చేయడానికి నన్ను అడగండి.",
  },
};
