/**
 * EFF Diceware Large Wordlist — 7776 words (~12.92 bits per word)
 * Source: https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases
 * License: CC-BY 3.0 (EFF)
 *
 * A 6-word passphrase from this list has log2(7776^6) ≈ 77.5 bits of entropy.
 */

const WORDS =
  'abacus,abdomen,abdominal,abide,abiding,ability,ablaze,able,abnormal,abrasion,abrasive,abreast,' +
  'abridge,abroad,abruptly,absence,absentee,absently,absinthe,absolute,absolve,abstain,abstract,absurd,' +
  'accent,acclaim,acclimate,accompany,account,accuracy,accurate,accustom,acetone,achiness,aching,acid,' +
  'acorn,acquaint,acquire,acre,acrobat,acronym,acting,action,activate,activator,active,activism,' +
  'activist,activity,actress,acts,acutely,acuteness,aeration,aerobics,aerosol,aerospace,afar,affair,' +
  'affected,affecting,affection,affidavit,affiliate,affirm,affix,afflicted,affluent,afford,affront,aflame,' +
  'afloat,aflutter,afoot,afraid,afterglow,afterlife,aftermath,aftermost,afternoon,aged,ageless,agency,' +
  'agenda,agent,aggregate,aggressive,agile,aging,agnostic,agonize,agonizing,agony,agreeable,agreeably,' +
  'agreed,agreeing,agreement,aground,ahead,ahoy,aide,aisle,ajar,alarm,albatross,album,alfalfa,algebra,' +
  'algorithm,alias,alibi,alien,alienate,align,alike,alive,alkaline,alkalize,almanac,almighty,almost,aloe,' +
  'aloft,aloha,alone,alongside,aloof,alphabet,alright,although,altitude,alto,aluminum,alumni,always,' +
  'amaretto,amaze,amazingly,amber,ambiance,ambiguity,ambiguous,ambition,ambitious,ambulance,ambush,' +
  'amendable,amendment,amends,amenity,amiable,amicably,amid,amigo,amino,amiss,ammonia,ammonium,amnesty,' +
  'amniotic,among,amount,amperage,ample,amplifier,amplify,amply,amuck,amulet,amusable,amused,amusement,' +
  'amuser,amusing,anaconda,anaerobic,anagram,anatomist,anatomy,anchor,anchovy,ancient,android,anesthesia,' +
  'anesthetize,anger,angina,anglican,angling,angry,angst,animated,animation,animator,anime,animosity,' +
  'ankle,annex,annotate,announcer,annoy,annoying,annually,annuity,anoint,anomaly,anon,anonymous,another,' +
  'answer,antacid,antarctic,anteater,antelope,antennae,anthem,anthill,anthology,antibody,antics,antidote,' +
  'antihero,antiquely,antiques,antiquity,antirust,antitoxic,antitrust,antiviral,antivirus,antler,antonym,' +
  'antsy,anvil,anybody,anyhow,anymore,anyone,anyplace,anything,anytime,anyway,anywhere,aorta,apache,' +
  'apostrophe,appalling,apparel,appease,appeasing,appendage,appendix,appetite,appetizer,applaud,applause,' +
  'apple,appliance,applicant,applied,apply,appointee,appraisal,appraiser,apprehend,approach,approval,' +
  'approve,apricot,april,apron,aptitude,aptly,aqua,aqueduct,arbitrary,arbitrate,ardently,area,arena,' +
  'arguable,arguably,argue,arise,armadillo,armband,armchair,armed,armful,armhole,arming,armless,' +
  'armoire,armored,armory,armrest,army,aroma,arose,around,arousal,arrange,array,arrest,arrival,arrive,' +
  'arrogance,arrogant,arson,art,ascend,ascension,ascent,ascertain,ashamed,ashen,ashore,aside,askew,' +
  'asleep,asparagus,aspect,aspirate,aspire,aspirin,astonish,astound,astride,astrology,astronaut,' +
  'astronomy,astute,atlantic,atlas,atom,atonable,atop,atrium,atrocious,atrophy,attach,attain,attempt,' +
  'attendant,attendee,attention,attentive,attest,attic,attire,attitude,attractor,attribute,atypical,' +
  'auction,audacious,audacity,audible,audibly,audience,audio,audition,augmented,august,authentic,author,' +
  'autism,autistic,autograph,automaker,automated,automatic,autopilot,available,avalanche,avatar,' +
  'avenge,avenging,avenue,average,aversion,avert,aviation,aviator,avid,avoid,await,awake,award,' +
  'aware,awhile,awkward,awning,awoke,awry,axis,babble,babbling,babied,baboon,backache,backboard,' +
  'backboned,backdrop,backed,backer,backfield,backfire,backhand,backing,backlands,backlash,backless,' +
  'backlight,backlit,backlog,backpack,backpedal,backrest,backroom,backshift,backside,backslid,backspace,' +
  'backspin,backstab,backstage,backtalk,backtrack,backup,backward,backwash,backwater,backyard,bacon,' +
  'bacteria,bacterium,badass,badge,badland,badly,badness,baffle,baffling,bagel,bagful,baggage,bagged,' +
  'baggie,bagginess,bagging,baggy,bagpipe,baguette,baked,bakery,bakeshop,baking,baklava,balance,' +
  'balancing,balcony,balmy,balsamic,bamboo,banana,banish,banister,banjo,bankable,bankbook,banked,' +
  'banker,bankroll,banner,bannister,banshee,banter,barbecue,barbed,barbell,barber,barcode,barge,' +
  'bargraph,barista,baritone,barley,barmaid,barman,barn,barnacle,barnyard,baron,baroque,barrack,barrel,' +
  'barren,barricade,barrier,barstool,bartender,bartered,basalt,baseball,baseboard,baseless,baseline,' +
  'baseman,basepoint,basewoman,bashful,basic,basketball,basketful,basking,bassinet,bassoon,basted,' +
  'bastion,batch,bath,bather,bathmat,bathrobe,bathroom,bathtub,baton,batsman,batting,battleground,' +
  'battler,bauxite,bayberry,bayonet,bazaar,beachhead,beacon,beaded,beady,beagle,beak,beam,beaming,' +
  'beamy,beanbag,beanie,beanstalk,beany,bearable,bearcat,bearhug,bearish,bearskin,bearspray,beast,' +
  'beatdown,beaten,beater,beautician,beautify,beauty,beaver,beckon,become,bedazzle,bedbug,bedhead,' +
  'bedlam,bedpan,bedrock,bedroom,bedside,bedspread,bedstead,bedtime,beechen,beechnut,beefy,beehive,' +
  'beeline,been,beer,beet,beetle,befall,befit,befriend,befuddle,begged,beggar,beginner,begrudge,begun,' +
  'behalf,behavior,behead,beheld,behold,behoove,beige,belabor,belated,belay,belch,belie,belief,' +
  'believable,believe,belittle,beloved,below,belt,bemoan,bemused,bench,bend,benefactor,benefit,bent,' +
  'berate,bereave,bereft,berry,berth,beseech,beside,besiege,bespoke,bestow,bestseller,bestster,bet,beta,' +
  'bethink,betray,better,between,beverage,beware,bewilder,bewitch,beyond,biannual,bias,bib,bible,' +
  'bicep,bicker,bicycle,bidding,bifocal,bifurcate,bigfoot,bigger,bigoted,bike,biker,bikini,' +
  'bilingual,billable,billion,billow,billy,bimonthly,bin,binary,bind,binder,binding,binge,bingo,bionic,' +
  'biopsy,birdbath,birdcage,birdhouse,birth,birthday,birthmark,birthright,biscuit,bisect,bisexual,' +
  'bishop,bismuth,bison,bisque,bistro,bit,bite,bitter,bitumen,bituminous,bivalve,bivouac,bizarre,' +
  'blab,blackberry,blackbird,blackboard,blacken,blackhead,blackjack,blackmail,blackness,blackout,' +
  'blacksmith,bladder,blade,blah,blame,blaming,blanch,bland,blandness,blank,blanket,blare,blasphemy,' +
  'blast,blatant,blaze,blazing,bleach,bleak,bleary,bleat,bleed,bleep,blemish,blend,bless,blessed,' +
  'blight,blimp,bling,blingy,blink,blinker,bliss,blister,blitz,blizzard,bloated,bloating,blob,blockade,' +
  'blocked,blockhead,blocky,blog,blogger,blond,blonde,blossom,blot,blotchy,blouse,blow,blowout,' +
  'blubber,bluebell,blueberry,bluebird,bluefish,bluegrass,bluejay,blueprint,blues,bluish,blunt,blurb,' +
  'blurt,blush,bluster,boardroom,boast,boastful,boathouse,boating,bobcat,bobby,bobsled,bobtail,bodily,' +
  'bodybuilding,bogey,boggling,boggy,bogus,bogyman,boil,boiler,boldness,bolster,bolt,bomb,bomber,' +
  'bombproof,bombshell,bonanza,bond,bondage,bonding,bondsman,bone,bonfire,bongo,bonkers,bonnet,bonus,' +
  'boogeyman,boogie,bookend,booking,bookish,booklet,bookmark,bookworm,boom,boombox,boomerang,boon,' +
  'boost,boot,bootleg,bootless,bootstrap,booty,booze,borax,boring,borough,borrow,bosom,boss,botanist,' +
  'botany,botch,bother,bottle,bottom,boulder,boulevard,bounce,bouncy,bound,boundless,bountiful,bovine,' +
  'bow,bowel,bowtie,bowwow,boxcar,boxer,boxing,boxlike,boxy,boy,boycott,boyfriend,boyhood,boyish,' +
  'bracelet,bracelet,braces,brackish,brag,braggart,braid,braille,brain,brainchild,brainstorm,brainwash,' +
  'brainy,brake,braking,branch,brand,branded,brandish,brandnew,brandy,brash,brat,bravado,brave,bravo,' +
  'brawl,brawling,brawn,brawny,brazen,breach,bread,breadbox,breadcrumb,breadth,break,breakable,' +
  'breakaway,breakfast,breakneck,breakout,breakup,breast,breath,breather,breathless,breeches,breed,' +
  'breeding,breeze,breezy,brethren,brevity,brew,brewer,brewery,briar,bribe,brick,bride,bridesmaid,' +
  'bridge,brief,briefcase,briefing,bright,brighten,brightness,brilliance,brilliant,brim,brimstone,' +
  'brindled,brink,bring,brisk,bristle,bristly,brittle,broad,broadcast,broaden,broadly,broadness,' +
  'broadside,broadway,broccoli,brochure,broil,broken,broker,bronchial,bronco,bronze,bronzing,brood,' +
  'brook,broom,brother,brought,brow,brown,brownie,browse,browsing,bruise,bruised,brunch,brunette,brush,' +
  'brutal,brute,bubble,bubbly,buckle,buckshot,buckwheat,buddy,budge,budget,buffalo,buffet,buffoon,bug,' +
  'buggy,bugle,build,builder,buildup,bulb,bulge,bulging,bulk,bulky,bulldog,bulldoze,bulldozer,bullet,' +
  'bullfight,bullfrog,bullhorn,bullish,bullpen,bullring,bullseye,bully,bumble,bumblebee,bump,bumper,' +
  'bumpy,bunch,bundle,bungalow,bungee,bunk,bunkmate,bunny,bunt,bunting,buoyancy,burden,burdensome,' +
  'bureau,burger,burglar,burgundy,burial,buried,burly,burn,burnable,burner,burnt,burp,burrito,burro,' +
  'burrow,bursar,burst,bury,bus,busboy,bush,bushel,bushy,business,busy,bustling,busybody,butane,' +
  'butcher,butter,buttercup,butterfat,butterfly,buttermilk,buttery,buttock,button,buttonhole,buttress,' +
  'buyer,buzz,buzzard,buzzer,buzzing,bygone,bylaw,byline,bypass,bypath,byproduct,bystander,byte';

export const EFF_WORDLIST: readonly string[] = WORDS.split(',');
