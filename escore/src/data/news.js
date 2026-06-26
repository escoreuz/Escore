// eSOCRE — gazeta uchun futbol yangiliklari (demo kontent)

export const ISSUE = {
  volume: 'XII SON',
  no: '№ 247',
  city: 'TOSHKENT',
  weekday: 'SESHANBA',
  date: '23-iyun, 2026-yil',
  price: 'NARXI: 5 000 so\'m',
  weather: 'Bugun ochiq • +31°C',
}

export const TICKER = [
  'SO\'NGGI DAQIQA: Real Madrid yangi murabbiyni rasman tasdiqladi',
  'Messi MLS pley-offida yana gol urdi',
  'Yer kurrasi chempionati saralashi: O\'zbekiston 2:0 yutdi',
  'Premier-liga: City va Arsenal ochilishda to\'qnashadi',
  'Transfer bozori: 120 mln yevroli bitim yakunlandi',
]

// ---- Barcha maqolalar (slug bo'yicha sahifa ochiladi) ----
export const ARTICLES = [
  {
    slug: 'tarixiy-yakun-chempion',
    section: 'CHEMPIONLAR LIGASI',
    kicker: 'BOSH MAQOLA · CHEMPIONLAR LIGASI',
    title: 'Tarixiy yakun: yangi chempion toj kiydi',
    standfirst:
      'Final uchrashuvi so\'nggi daqiqalargacha taranglikni saqladi. Maydon hakami qo\'shimcha vaqt belgilagach, stadion nafasini ichiga yutdi — va g\'olib o\'z nomini tarixga yozdi.',
    author: 'A. Rahimov',
    date: '23-iyun, 2026',
    readTime: '6 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Final hushtagidan so\'ng — g\'oliblar kubokni osmonga ko\'taradi.',
    body: [
      'Yetmish to\'qqizinchi daqiqada to\'p darvoza to\'riga ilingach, 80 ming tomoshabin bir lahzaga jim qoldi, so\'ng stadion gumburlab ketdi. Bu gol nafaqat uchrashuv taqdirini, balki butun mavsum mehnatining yakunini hal qildi.',
      'Murabbiy matbuot anjumanida: «Bu jamoa bir yil davomida bitta maqsad sari yurdi. Bugun biz tarixning bir qismiga aylandik», — dedi. Sport tahlilchilari uchrashuvni so\'nggi o\'n yillikdagi eng sifatli final deb baholashmoqda.',
      'Birinchi taym maydon o\'rtasidagi kurash bilan o\'tdi. Ikki jamoa ham xato qilishdan cho\'chib, ehtiyotkor o\'ynadi. Tanaffusgacha darvozalarga jiddiy xavf solinmadi, biroq taktik jang sezilarli edi.',
      'Ikkinchi taymda o\'yin tezlashdi. Murabbiyning hujumchini maydonga tushirgani vaziyatni o\'zgartirdi — aynan u hal qiluvchi uzatmani amalga oshirdi. Himoyachilar bir soniyaga kechikishdi va bu kifoya qildi.',
      'Klub muxlislari shahar markazida tong otguncha bayram qilishdi. Ertangi sonimizda finalning to\'liq taktik tahlili va g\'olib jamoa yo\'lboshchisi bilan eksklyuziv suhbatni e\'lon qilamiz.',
      'Mutaxassislar fikricha, bu g\'alaba klub uchun yangi davrning boshlanishi bo\'lishi mumkin. Yosh tarkib, tajribali murabbiy va kuchli muxlislar — kelajak uchun mustahkam poydevor.',
    ],
  },
  {
    slug: 'asr-bitimi-transfer',
    section: 'TRANSFER',
    kicker: 'TRANSFER',
    title: 'Asr bitimi: yulduz hujumchi yangi klubga o\'tdi',
    standfirst:
      'Yevropaning eng qimmat o\'tkazmalaridan biri rasman yakunlandi. Shartnoma besh yilga imzolandi va miqdori rekord darajada.',
    author: 'M. Karimov',
    date: '22-iyun, 2026',
    readTime: '4 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Yangi futbolchi klub sharfini ko\'tarib muxlislarni olqishladi.',
    body: [
      'Uzoq davom etgan muzokaralar nihoyat yakuniga yetdi. Ikki klub o\'rtasidagi bitim summasi bonuslar bilan birga rekord ko\'rsatkichga yetdi va matbuotda keng muhokama qilinmoqda.',
      'Hujumchi taqdimot marosimida: «Bu mening orzuyimdagi klub edi. Bu yerda kubok uchun kurashmoqchiman», — dedi. Muxlislar uni stadionda iliq kutib olishdi.',
      'Sport direktori transferni «strategik investitsiya» deb atadi. Klub kelgusi mavsumda Chempionlar Ligasida jiddiy da\'vogarlardan biri bo\'lishni rejalashtirmoqda.',
      'Tahlilchilar bitimning moliyaviy tomonini diqqat bilan kuzatmoqda. Fair-play qoidalariga rioya qilish uchun klub bir nechta o\'yinchini sotishi kutilmoqda.',
    ],
  },
  {
    slug: 'ozbekiston-saralash',
    section: 'MILLIY TERMA',
    kicker: 'MILLIY TERMA',
    title: 'O\'zbekiston saralash bosqichida yetakchilikni saqladi',
    standfirst:
      'Mezbonlar ishonchli o\'yin ko\'rsatib, guruhda birinchi o\'rinni mustahkamladi. Keyingi uchrashuv kuzda bo\'lib o\'tadi.',
    author: 'D. Yusupova',
    date: '21-iyun, 2026',
    readTime: '5 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Terma jamoa muxlislari oldida g\'alabani nishonladi.',
    body: [
      'To\'la stadion oldida o\'ynagan terma jamoa boshidan oxirigacha o\'yin ustunligini qo\'ldan bermadi. Ikkala gol ham birinchi taymda urildi va natija hech qachon shubha ostida qolmadi.',
      'Bosh murabbiy yoshlarga ishonch bildirdi va bu o\'zini oqladi. Maydonga chiqqan yangi avlod futbolchilari jasorat va intizom bilan o\'ynadi.',
      'Guruhdagi vaziyat endi mezbonlar foydasiga. Keyingi bosqichga yo\'llanma olish uchun kuzgi uchrashuvda hech bo\'lmaganda durang yetarli bo\'ladi.',
      'Muxlislar markazlashgan tarafkashlar bilan haqiqiy bayram kayfiyatini yaratdi. Federatsiya keyingi o\'yinga chiptalar tez sotilishini ma\'lum qildi.',
    ],
  },
  {
    slug: 'yosh-oyinchilar-yili',
    section: 'TAHLIL',
    kicker: 'TAHLIL',
    title: 'Nega bu mavsum yosh o\'yinchilar yili bo\'ldi?',
    standfirst:
      'Yevropaning yetakchi ligalarida 21 yoshgacha bo\'lgan futbolchilar rekord darajada o\'yinga chiqdi. Sabablari va oqibatlari haqida.',
    author: 'A. Rahimov',
    date: '20-iyun, 2026',
    readTime: '7 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Akademiya bitiruvchilari asosiy tarkibga tobora ko\'proq kirib bormoqda.',
    body: [
      'So\'nggi statistik hisobotlar qiziq tendensiyani ko\'rsatdi: top-besh chempionatda yosh futbolchilarning o\'yin daqiqalari oxirgi o\'n yillikdagi eng yuqori darajaga yetdi.',
      'Buning bir necha sababi bor. Birinchidan, transfer bozorining qimmatlashishi klublarni o\'z akademiyalariga e\'tibor qaratishga majbur qildi. Ikkinchidan, zamonaviy taktika tezkor va chaqqon o\'yinchilarni talab qiladi.',
      'Murabbiylar ham yondashuvni o\'zgartirdi. Endi yosh o\'yinchiga vaqt berish — risk emas, balki strategiya. Tajriba shuni ko\'rsatdiki, erta o\'yin amaliyoti iste\'dodni tezroq ochadi.',
      'Albatta, bu yondashuvning xavflari ham bor. Haddan tashqari yuk yosh organizmga salbiy ta\'sir qilishi mumkin. Shu sababli klublar yuklamani ehtiyotkorlik bilan boshqarmoqda.',
      'Umumiy xulosa shuki, futbol yangilanmoqda. Kelgusi mavsumlarda bu avlod jahon futbolining yangi yulduzlarini berishi kutilmoqda.',
    ],
  },
  {
    slug: 'raqamlar-emas-hikoyalar',
    section: 'MUXBIR USTUNI',
    kicker: 'MUXBIR USTUNI',
    title: 'Futbol — bu raqamlar emas, hikoyalar',
    standfirst:
      'Statistika o\'yinning skeletini ko\'rsatadi, ammo jonini emas. Haqiqiy futbol — bu maydondagi jasorat va muxlis qalbidagi umiddir.',
    author: 'A. Rahimov',
    date: '19-iyun, 2026',
    readTime: '3 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Stadiondagi har bir bayroq — alohida hikoya.',
    body: [
      'Biz futbolni tobora ko\'proq raqamlar orqali tushunadigan bo\'lib qoldik: egallash foizi, kutilgan gollar, yugurilgan masofa. Bularning barchasi foydali, lekin ular o\'yinning yuragini ko\'rsata olmaydi.',
      'Eslang, eng yorqin xotiralaringiz qaysi statistika bilan bog\'liq edi? Ehtimol, hech qaysi biri bilan emas. Ular hissiyot — kutilmagan gol, mardona kurash, mag\'lubiyatdan keyin oyoqqa turish bilan bog\'liq.',
      'Haqiqiy futbol — bu maydondagi jasorat va minglab muxlis qalbidagi umiddir. Raqamlar tahlil uchun, hikoyalar esa sevgi uchun. Ikkalasi ham kerak, lekin ularni adashtirmaylik.',
    ],
  },
  {
    slug: 'yuqori-pressing-davri',
    section: 'TAKTIKA',
    kicker: 'TAKTIKA',
    title: 'Yuqori pressing davri qaytdimi?',
    standfirst:
      'So\'nggi mavsumda eng muvaffaqiyatli jamoalar raqibni o\'z yarim maydonida bo\'g\'ish strategiyasiga qaytdi. Bu jismoniy tayyorgarlikka yangi talab qo\'yadi.',
    author: 'D. Yusupova',
    date: '18-iyun, 2026',
    readTime: '5 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Butun jamoa bilan pressing — zamonaviy futbolning belgisi.',
    body: [
      'Bir necha mavsum oldin ko\'pchilik «pressing modasi o\'tdi» deb hisoblardi. Biroq bu mavsum natijalari aksini ko\'rsatdi: chempionlikka da\'vogar jamoalarning aksariyati agressiv yuqori pressingdan foydalandi.',
      'Pressingning mohiyati — raqibga to\'p bilan o\'ylash uchun vaqt bermaslik. Bu esa butun jamoaning uyg\'un harakatini va a\'lo jismoniy holatini talab qiladi.',
      'Aynan shu sababli klublar tibbiy va tayyorgarlik bo\'limlariga ko\'proq sarmoya kiritmoqda. Jarohatlar oldini olish va tiklanish endi g\'alabaning bir qismi.',
      'Savol ochiqligicha qolmoqda: bu strategiya barqarormi yoki navbatdagi taktik to\'lqin uni yana o\'zgartiradimi? Keyingi mavsum javob beradi.',
    ],
  },
  {
    slug: 'har-gol-yangi-boshlanish',
    section: 'INTERVYU',
    kicker: 'INTERVYU',
    title: '«Har bir gol — yangi boshlanish»',
    standfirst:
      'Mavsum bombardiri bilan suhbat: motivatsiya, mashg\'ulot tartibi va yosh futbolchilarga maslahatlar haqida ochiq gaplashdik.',
    author: 'M. Karimov',
    date: '17-iyun, 2026',
    readTime: '8 daqiqa o\'qish',
    photoTag: 'FOTO · eSCORE',
    caption: 'Mavsum bombardiri mashg\'ulotdan keyin suhbat berdi.',
    body: [
      '— Bu mavsum siz uchun rekord bo\'ldi. Sirri nimada?',
      '— Sir yo\'q. Har kuni mehnat, intizom va o\'yinga bo\'lgan muhabbat. Men har bir golni yangi boshlanish deb qabul qilaman — kechagi muvaffaqiyat bugun hisobga olinmaydi.',
      '— Mashg\'ulot tartibingiz qanday?',
      '— Ertalab tiklanish va kuch mashqlari, tushdan keyin to\'p bilan ishlash. Lekin eng muhimi — uyqu va ovqatlanish. Yoshlar buni ko\'pincha e\'tiborsiz qoldiradi.',
      '— Yosh futbolchilarga maslahatingiz?',
      '— Sabrli bo\'ling. Hamma narsa bir kunda kelmaydi. Mag\'lubiyatdan qo\'rqmang — u eng yaxshi ustoz. Va doimo jamoa uchun o\'ynang, o\'zingiz uchun emas.',
    ],
  },
]

export const STANDINGS = [
  { pos: 1, club: 'Manchester City', p: 34, w: 26, d: 5, l: 3, pts: 83 },
  { pos: 2, club: 'Arsenal', p: 34, w: 25, d: 6, l: 3, pts: 81 },
  { pos: 3, club: 'Liverpool', p: 34, w: 23, d: 7, l: 4, pts: 76 },
  { pos: 4, club: 'Real Madrid', p: 34, w: 22, d: 8, l: 4, pts: 74 },
  { pos: 5, club: 'Inter', p: 34, w: 21, d: 9, l: 4, pts: 72 },
  { pos: 6, club: 'Bayern', p: 34, w: 21, d: 6, l: 7, pts: 69 },
]

export const RESULTS = [
  { home: 'Barcelona', hs: 3, away: 'Sevilla', as: 1 },
  { home: 'Juventus', hs: 2, away: 'Milan', as: 2 },
  { home: 'PSG', hs: 4, away: 'Lyon', as: 0 },
  { home: 'Chelsea', hs: 1, away: 'Tottenham', as: 1 },
  { home: 'Pakhtakor', hs: 2, away: 'Nasaf', as: 0 },
]

export const FIXTURES = [
  { time: '21:00', home: 'Real Madrid', away: 'Atletico' },
  { time: '23:00', home: 'Man United', away: 'Newcastle' },
  { time: '20:30', home: 'Dortmund', away: 'Leipzig' },
  { time: '19:00', home: 'AGMK', away: 'Bunyodkor' },
]

export const BRIEFS = [
  'VAR tizimi keyingi mavsumdan yarim avtomatik ofsayd bilan ishlaydi.',
  'Oltin to\'p nomzodlari ro\'yxati keyingi haftada e\'lon qilinadi.',
  'Yangi stadion qurilishi reja bo\'yicha 18 oyda yakunlanadi.',
  'Yoshlar ligasi finali shanba kuni bo\'lib o\'tadi.',
  'Hakamlar uchun yangi sog\'lomlashtirish standarti joriy etildi.',
]

export const QUOTE = {
  text: 'Futbolda eng muhimi — hech qachon taslim bo\'lmaslik. O\'yin so\'nggi hushtakgacha tugamaydi.',
  author: 'Afsonaviy murabbiy',
}

// ---- Yordamchilar ----
export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug)

// Bosh sahifa bloklari maqolalardan tuziladi
export const LEAD = ARTICLES[0]
export const SECONDARY = ARTICLES.slice(1, 4)
export const COLUMNS = ARTICLES.slice(4, 7)
