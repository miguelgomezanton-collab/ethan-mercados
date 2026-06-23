// ═══════════════════════════════════════════════
// MÓDULO: Screener Alcista
// Interfaz tabla (Ticker/Sector/Score/Estado/Precio/Acción)
// Pestañas independientes por índice — cada una tiene su propio
// estado de escaneo, pudiendo ejecutarse simultáneamente.
// Motor: MACD(12,26,9) + Stoch(89,3,3) + RSI(14) + EMA
// Filtro de volumen post-escaneo configurable.
// ═══════════════════════════════════════════════

// ── Universos ──────────────────────────────────
const INDICES_CONFIG = [
  { key: 'SP500',      label: 'S&P 500',          flag: '🇺🇸' },
  { key: 'NDX100',     label: 'NASDAQ 100',        flag: '🇺🇸' },
  { key: 'NYSE',       label: 'NYSE',              flag: '🇺🇸' },
  { key: 'EUROSTOXX50',label: 'EuroStoxx 50',      flag: '🇪🇺' },
  { key: 'DAX40',      label: 'DAX 40',            flag: '🇩🇪' },
  { key: 'FTSE100',    label: 'FTSE 100',          flag: '🇬🇧' },
  { key: 'IBEX35',     label: 'IBEX 35',           flag: '🇪🇸' },
];

const TICKERS = {
  SP500: ["MMM","AOS","ABT","ABBV","ACN","ADBE","AMD","AES","AFL","A","APD","ABNB","AKAM","ALB","ARE","ALGN","ALLE","LNT","ALL","GOOGL","GOOG","MO","AMZN","AMCR","AEE","AAL","AEP","AXP","AIG","AMT","AWK","AMP","AME","AMGN","APH","ADI","ANSS","AON","APA","AAPL","AMAT","APTV","ACGL","ADM","ANET","AJG","AIZ","T","ATO","ADSK","ADP","AZO","AVB","AVY","AXON","BKR","BALL","BAC","BBWI","BAX","BDX","BRK-B","BBY","TECH","BIIB","BIO","BLK","BX","BK","BA","BKNG","BWA","BSX","BMY","AVGO","BR","BRO","BG","CHRW","CDNS","CZR","CPT","CPB","COF","CAH","KMX","CCL","CARR","CAT","CBOE","CBRE","CDW","CE","COR","CNC","CNP","CF","CHTR","CVX","CMG","CB","CHD","CI","CINF","CTAS","CSCO","C","CFG","CLX","CME","CMS","KO","CTSH","CL","CMCSA","CMA","CAG","COP","ED","STZ","CEG","COO","CPRT","GLW","CPAY","CTVA","CSGP","COST","CTRA","CRWD","CCI","CSX","CMI","CVS","DHR","DRI","DVA","DAY","DECK","DE","DELL","DAL","DVN","DXCM","FANG","DLR","DFS","DG","DLTR","D","DPZ","DOV","DOW","DHI","DTE","DUK","DD","EMN","ETN","EBAY","ECL","EIX","EW","EA","ELV","EMR","ENPH","ETR","EOG","EQT","EFX","EQIX","EQR","ESS","EL","ETSY","EG","EVRG","ES","EXC","EXPE","EXPD","EXR","XOM","FFIV","FDS","FICO","FAST","FRT","FDX","FITB","FSLR","FE","FIS","FI","FLT","FMC","F","FTNT","FTV","FOXA","FOX","BEN","FCX","GRMN","IT","GE","GEHC","GEN","GD","GIS","GM","GPC","GILD","GPN","GL","GDDY","GS","HAL","HIG","HAS","HCA","DOC","HSIC","HSY","HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HWM","HPQ","HUBB","HUM","HBAN","HII","IBM","IEX","IDXX","ITW","INCY","IR","PODD","INTC","ICE","IFF","IP","IPG","INTU","ISRG","IVZ","INVH","IQV","IRM","JBHT","JBL","JKHY","J","JNJ","JCI","JPM","JNPR","K","KVUE","KDP","KEY","KEYS","KMB","KIM","KMI","KKR","KLAC","KHC","KR","LHX","LH","LRCX","LW","LVS","LDOS","LEN","LIN","LYV","LKQ","LMT","L","LOW","LULU","LYB","MTB","MRO","MPC","MKTX","MAR","MMC","MLM","MAS","MA","MTCH","MKC","MCD","MCK","MDT","MRK","META","MET","MTD","MGM","MCHP","MU","MSFT","MAA","MRNA","MHK","MOH","TAP","MDLZ","MPWR","MNST","MCO","MS","MOS","MSI","MSCI","NDAQ","NTAP","NFLX","NEM","NWSA","NWS","NEE","NKE","NI","NDSN","NSC","NTRS","NOC","NCLH","NRG","NUE","NVDA","NVR","NXPI","ORLY","OXY","ODFL","OMC","ON","OKE","ORCL","OTIS","PCAR","PKG","PANW","PARA","PH","PAYX","PAYC","PYPL","PNR","PEP","PFE","PCG","PM","PSX","PNW","PNC","POOL","PPG","PPL","PFG","PG","PGR","PLD","PRU","PEG","PTC","PSA","PHM","QRVO","PWR","QCOM","DGX","RL","RJF","RTX","O","REG","REGN","RF","RSG","RMD","RVTY","ROK","ROL","ROP","ROST","RCL","SPGI","CRM","SBAC","SLB","STX","SRE","NOW","SHW","SPG","SWKS","SJM","SW","SNA","SOLV","SO","LUV","SWK","SBUX","STT","STLD","STE","SYK","SMCI","SYF","SNPS","SYY","TMUS","TROW","TTWO","TPR","TRGP","TGT","TEL","TDY","TFX","TER","TSLA","TXN","TXT","TMO","TJX","TSCO","TT","TDG","TRV","TRMB","TFC","TYL","TSN","USB","UBER","UDR","ULTA","UNP","UAL","UPS","URI","UNH","UHS","VLO","VTR","VRSN","VRSK","VZ","VRTX","VLTO","VFC","VTRS","VICI","V","VST","VMC","WRB","GWW","WAB","WBA","WMT","DIS","WBD","WM","WAT","WEC","WFC","WELL","WST","WDC","WY","WMB","WTW","WYNN","XEL","XYL","YUM","ZBRA","ZBH","ZTS"],
  NDX100: ["AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","TSLA","AVGO","COST","NFLX","TMUS","CSCO","AMD","ADBE","PEP","INTU","TXN","QCOM","ISRG","CMCSA","BKNG","AMAT","REGN","MU","PANW","LRCX","VRTX","KLAC","ADI","MRVL","ABNB","CDNS","SNPS","CRWD","CEG","MELI","ORLY","CTAS","MAR","FTNT","PCAR","PAYX","DASH","WDAY","ROST","AZO","ODFL","CPRT","FANG","FAST","KHC","BIIB","ON","DDOG","IDXX","TEAM","SIRI","EXC","MNST","DLTR","GEHC","MRNA","NXPI","WBD","SPLK","SBUX","VRSK","SMCI","ROP","TTWO","ALGN","WBA","DXCM","ANSS","GFS","ILMN","MDB","LCID","ZS","ENPH","OKTA","RIVN","SNOW","TTD","VRSN","CHTR","MTCH","ASML","SGEN","PYPL","BMRN","CTSH","GILD","LULU","ADSK","EA","EBAY","AEP","TSCO"],
  NYSE: [
    // Financials — Bancos grandes y regionales
    "JPM","BAC","WFC","C","GS","MS","USB","PNC","TFC","COF","BK","STT","MTB","CFG","HBAN",
    "RF","KEY","NTRS","FITB","CMA","ZION","FHN","SNV","BOH","WTFC","UMBF","EWBC","FFIN",
    "IBOC","BPOP","ALLY","SYF","DFS","NYCB","RJF","SIVB","CVBF","WAFD","HOMB","BANR",
    // Financials — Seguros
    "AIG","TRV","CB","ALL","PGR","HIG","AJG","MMC","AON","WTW","BRO","CINF","RE","ACGL",
    "GL","FNF","FAF","RGA","CNO","AFL","MET","PRU","LNC","UNM","PFG","MKL","RLI","HCI",
    // Financials — Bolsas y otros
    "ICE","CME","SPGI","MCO","BX","KKR","BLK","SCHW",
    // Healthcare — Farma y biotech
    "JNJ","PFE","MRK","LLY","BMY","ABBV","AMGN","GILD","REGN","BIIB","VRTX","MRNA",
    // Healthcare — Servicios e instrumental
    "UNH","CVS","ELV","CI","HUM","MOH","CNC","HCA","DGX","LH","SYK","MDT","BSX","ABT",
    "BDX","DHR","TMO","A","WAT","IQV","ZBH","BAX","STE","HSIC","HOLX","TECH","BIO","RVTY",
    "PODD","INCY","DXCM","ALGN","DVA","UHS","THC","ENSG","CHE","ADUS","MEDP",
    // Energy — Majors y E&P
    "XOM","CVX","COP","OXY","DVN","HAL","SLB","BKR","MPC","VLO","PSX","EOG","APA","MRO",
    "LNG","CQP","SM","CIVI","NOG","MTDR","PR","CHRD","MGY","PBF","DINO","HFC","VVV",
    // Energy — Midstream
    "KMI","WMB","OKE","TRGP","ET","WES","MPLX","EPD","PAA","PAGP","ENLC","DKL",
    // Materials
    "LIN","APD","ECL","DOW","DD","LYB","PPG","SHW","NEM","FCX","NUE","STLD","CF","MLM",
    "VMC","IP","PKG","SEE","AVY","BALL","AMCR","ATI","AA","X","CLF","RS","EMN","OLN",
    "HUN","TROX","FUL","RPM","AXTA","ALB","MP","LTHM","CBT","ASIX","BCPC","HWKN",
    // Industrials — Defensa y aeroespacial
    "GE","HON","RTX","LMT","NOC","GD","BA","HII","TDG","HEI","HWM","SPR","TXT","LDOS",
    "BAH","CACI","MANT","KBR","SAIC","L3H","DRS",
    // Industrials — Maquinaria y equipos
    "CAT","DE","EMR","ETN","PH","ITW","ROK","AME","IR","PCAR","OTIS","CARR","AXON","TT",
    "XYL","GNRC","JCI","ROP","GWW","SNA","MSM","NDSN","RBC","KMT","BMI","CFX","GTLS","MWA",
    "ESCO","DCI","TDY","AMETEK","IDEX","FLOW","MIDD","SPXC",
    // Industrials — Transporte y logística
    "UPS","FDX","CSX","UNP","NSC","WAB","JBHT","ODFL","EXPD","CTAS","FAST","CHRW",
    "SAIA","WERN","ARCB","XPO","GXO","RXO","LSTR","HTLD","MRTN",
    // Consumer Discretionary
    "NKE","HD","LOW","TJX","MCD","SBUX","CMG","DPZ","YUM","DRI","EL","PVH","RL","TPR",
    "KMX","AZO","ORLY","APTV","BWA","LKQ","WHR","POOL","DHI","LEN","PHM","NVR","TOL",
    "MHO","KBH","MDC","BLDR","TREX","IBP","MCS","SSD","NWL","LEG","MHK","MLI","WDFC",
    "RCL","CCL","NCLH","MAR","HLT","MGM","LVS","WYNN","CZR","HGV","VAC","TNL",
    // Consumer Staples
    "PG","KO","PEP","PM","MO","MDLZ","KMB","CL","GIS","K","SJM","CAG","HRL","TSN","MKC",
    "CPB","CHD","CLX","WMT","KR","SFM","USFD","SYY","PFGC","BJ","INGR","BG","ADM","MOS",
    "NTR","CF","CTVA","FMC","CALM","LANC","JJSF","WEIS","SPTN","MGPI","UTZ","SMPL","IPAR",
    // Utilities
    "NEE","DUK","SO","D","AEP","EXC","SRE","PEG","XEL","ED","EIX","AEE","LNT","WEC","ES",
    "CMS","DTE","NI","CNP","EVRG","PNW","ATO","AWK","WTR","SJW","OGE","IDA","HE","AVA",
    "MGEE","BKH","ARTNA","CWCO",
    // Real Estate
    "PLD","AMT","CCI","SBAC","EQIX","DLR","EXR","PSA","AVB","EQR","ESS","MAA","CPT","UDR",
    "WELL","VTR","HST","REG","O","NNN","VICI","SPG","IRM","BXP","SLG","KIM","FRT","ARE",
    "INVH","TRNO","EGP","FR","REXR","STAG","COLD","IIPR","ADC","NTST","EPRT","NHI","HR",
    "DOC","MPW","PEB","RHP","XHR","APLE","CLDT","BHR","MAC","SKT","CBL",
    // Technology (cotizadas en NYSE)
    "IBM","ORCL","HPQ","HPE","CDW","DELL","WDC","STX","JNPR","NTAP","PSTG","CIEN","VIAV",
    "COMM","CALX","ACN","CTSH","IT","EPAM","GLOB","EFX","TYL","GPN","WEX","EVTC","FOUR",
    "QTWO","PCTY","HCKT","INVA","APPF",
    // Telecom y Media
    "T","VZ","LUMN","DISH","FYBR","CABO","ATUS","DIS","FOX","FOXA","PARA","WBD","LYV",
    "MSG","MSGS","CNK","IMAX",
    // Conglomerados
    "BRK-B","MMM","GE","HON","EMR","FTV"
  ],
  EUROSTOXX50: ["ASML.AS","LVMH.PA","TTE.PA","SAP.DE","SIE.DE","ALV.DE","ADYEN.AS","MC.PA","SAN.MC","INGA.AS","BNP.PA","AIR.PA","DTE.DE","ENEL.MI","OR.PA","MBG.DE","ABI.BR","BAYN.DE","IBE.MC","VOW3.DE","MUV2.DE","BMW.DE","PHIA.AS","DBK.DE","RMS.PA","CS.PA","SU.PA","AXA.PA","KER.PA","DSY.PA","HO.PA","AF.PA","DG.PA","RI.PA","BN.PA","SGO.PA","VIE.PA","ORA.PA","CAP.PA","ENI.MI","ISP.MI","UCG.MI","STLAM.MI","RACE.MI","G.MI","PRY.MI","AZM.MI","SRG.MI","MONC.MI"],
  DAX40: ["SAP.DE","SIE.DE","ALV.DE","MBG.DE","DTE.DE","BAYN.DE","VOW3.DE","MUV2.DE","BMW.DE","DBK.DE","RWE.DE","BAS.DE","EOAN.DE","HEN3.DE","MTX.DE","ZAL.DE","SHL.DE","DHL.DE","MRK.DE","IFX.DE","CON.DE","QIA.DE","PAH3.DE","BEI.DE","VNA.DE","ENR.DE","DHER.DE","AIR.DE","ADS.DE","FME.DE","FRE.DE","HEI.DE","LEG.DE","MAN.DE","PUM.DE","SDF.DE","SMHN.DE","SY1.DE","FME.DE","RHM.DE"],
  FTSE100: ["SHEL.L","AZN.L","HSBA.L","ULVR.L","BP.L","RIO.L","GSK.L","DGE.L","REL.L","NG.L","LLOY.L","BATS.L","BA.L","VOD.L","BHP.L","AAL.L","EXPN.L","LSEG.L","PRU.L","AHT.L","ABF.L","ANTO.L","AUTO.L","AV.L","BARC.L","BLND.L","BKG.L","BNZL.L","BRBY.L","CCH.L","CNA.L","CPG.L","CRDA.L","DCC.L","ENT.L","FERG.L","FLTR.L","GLEN.L","HIK.L","HLMA.L","IAG.L","IHG.L","IMB.L","INF.L","ITRK.L","JD.L","KGF.L","LAND.L","LGEN.L","MKS.L","MNDI.L","MRO.L","NWG.L","NXT.L","OCDO.L","PSON.L","RKT.L","RTO.L","SBRY.L","SDR.L","SGE.L","SMDS.L","SMIN.L","SMT.L","SN.L","SSE.L","STAN.L","SVT.L","TSCO.L","TW.L","UU.L","WEIR.L","WPP.L","WTB.L","III.L","ADM.L","AG.L","BDEV.L","BME.L","BOO.L","BTG.L","CLG.L","CNE.L","COB.L","DEMG.L","DPLM.L","ECM.L","EMG.L","FRES.L","GFS.L","HWDN.L","ICP.L","JMAT.L","MNG.L","MONY.L","MTRO.L"],
  IBEX35: ["SAN.MC","BBVA.MC","ITX.MC","IBE.MC","REP.MC","AMS.MC","CABK.MC","FER.MC","ACS.MC","MAP.MC","ENG.MC","GRF.MC","IAG.MC","LOG.MC","MEL.MC","NTGY.MC","PHM.MC","RED.MC","ROVI.MC","SAB.MC","TEF.MC","VIS.MC","CLNX.MC","COL.MC","ACX.MC","AENA.MC","ALM.MC","BKT.MC","MDF.MC","MRL.MC","UNI.MC","SGRE.MC","SOL.MC","SLR.MC","CAF.MC"]
};

const SECTOR_MAP = {
  'A':'XLV','AAPL':'XLK','ABBV':'XLV','ABNB':'XLY','ABT':'XLV','ACN':'XLK','ADBE':'XLK','ADI':'XLK','ADP':'XLI','ADSK':'XLK','AEE':'XLU','AEP':'XLU','AFL':'XLF','AIG':'XLF','AJG':'XLF','AKAM':'XLK','ALB':'XLB','ALGN':'XLV','ALL':'XLF','ALLE':'XLI','AMAT':'XLK','AMCR':'XLB','AMD':'XLK','AME':'XLI','AMGN':'XLV','AMP':'XLF','AMT':'XLRE','AMZN':'XLY','ANSS':'XLK','AON':'XLF','AOS':'XLI','APA':'XLE','APD':'XLB','APH':'XLK','ARE':'XLRE','ATO':'XLU','AVB':'XLRE','AVGO':'XLK','AVY':'XLB','AWK':'XLU','AXON':'XLI','AXP':'XLF','AZO':'XLY','BA':'XLI','BAC':'XLF','BALL':'XLB','BAX':'XLV','BBY':'XLY','BDX':'XLV','BEN':'XLF','BG':'XLP','BIO':'XLV','BK':'XLF','BKNG':'XLY','BKR':'XLE','BLK':'XLF','BMY':'XLV','BR':'XLI','BSX':'XLV','BWA':'XLY','C':'XLF','CAG':'XLP','CAH':'XLV','CARR':'XLI','CAT':'XLI','CB':'XLF','CBOE':'XLF','CBRE':'XLRE','CCI':'XLRE','CCL':'XLY','CDNS':'XLK','CE':'XLB','CEG':'XLU','CF':'XLB','CFG':'XLF','CHD':'XLP','CHRW':'XLI','CHTR':'XLC','CI':'XLV','CINF':'XLF','CL':'XLP','CLX':'XLP','CMA':'XLF','CMCSA':'XLC','CME':'XLF','CMG':'XLY','CMI':'XLI','CMS':'XLU','CNC':'XLV','CNP':'XLU','COF':'XLF','COP':'XLE','COR':'XLV','COST':'XLP','CPB':'XLP','CPRT':'XLI','CPT':'XLRE','CRM':'XLK','CSCO':'XLK','CSX':'XLI','CTRA':'XLE','CTSH':'XLK','CTVA':'XLB','CVS':'XLV','CVX':'XLE','CZR':'XLY','D':'XLU','DD':'XLB','DE':'XLI','DFS':'XLF','DG':'XLP','DGX':'XLV','DHI':'XLY','DHR':'XLV','DIS':'XLC','DLR':'XLRE','DLTR':'XLP','DOC':'XLRE','DOV':'XLI','DOW':'XLB','DPZ':'XLY','DRI':'XLY','DTE':'XLU','DUK':'XLU','DVA':'XLV','DVN':'XLE','DXCM':'XLV','EA':'XLC','EBAY':'XLY','ECL':'XLB','ED':'XLU','EFX':'XLF','EIX':'XLU','ELV':'XLV','EMN':'XLB','EMR':'XLI','ENPH':'XLK','EOG':'XLE','EQIX':'XLRE','EQR':'XLRE','EQT':'XLE','ES':'XLU','ESS':'XLRE','ETN':'XLI','ETSY':'XLY','EVRG':'XLU','EW':'XLV','EXC':'XLU','EXPD':'XLI','EXPE':'XLY','EXR':'XLRE','F':'XLY','FANG':'XLE','FAST':'XLI','FCX':'XLB','FDS':'XLF','FDX':'XLI','FE':'XLU','FFIV':'XLK','FICO':'XLK','FIS':'XLF','FITB':'XLF','FMC':'XLB','FOX':'XLC','FOXA':'XLC','FRT':'XLRE','FTNT':'XLK','FTV':'XLI','GD':'XLI','GDDY':'XLK','GE':'XLI','GILD':'XLV','GIS':'XLP','GLW':'XLK','GM':'XLY','GOOG':'XLC','GOOGL':'XLC','GPC':'XLY','GRMN':'XLY','GS':'XLF','HAL':'XLE','HBAN':'XLF','HCA':'XLV','HD':'XLY','HES':'XLE','HIG':'XLF','HLT':'XLY','HOLX':'XLV','HON':'XLI','HPQ':'XLK','HRL':'XLP','HSIC':'XLV','HST':'XLRE','HSY':'XLP','HUBB':'XLI','HUM':'XLV','HWM':'XLI','ICE':'XLF','IDXX':'XLV','IEX':'XLI','IFF':'XLB','INTC':'XLK','INTU':'XLK','INVH':'XLRE','IP':'XLB','IPG':'XLC','IQV':'XLV','IR':'XLI','ISRG':'XLV','IT':'XLK','ITW':'XLI','IVZ':'XLF','J':'XLI','JBHT':'XLI','JNJ':'XLV','JPM':'XLF','K':'XLP','KDP':'XLP','KEY':'XLF','KEYS':'XLK','KIM':'XLRE','KLAC':'XLK','KMB':'XLP','KMI':'XLE','KMX':'XLY','KO':'XLP','KR':'XLP','L':'XLF','LDOS':'XLI','LEN':'XLY','LH':'XLV','LHX':'XLI','LIN':'XLB','LKQ':'XLY','LMT':'XLI','LNT':'XLU','LOW':'XLY','LRCX':'XLK','LVS':'XLY','LW':'XLP','LYV':'XLC','LYB':'XLB','MA':'XLF','MAA':'XLRE','MAR':'XLY','MAS':'XLI','MCD':'XLY','MCHP':'XLK','MCK':'XLV','MCO':'XLF','MDLZ':'XLP','MDT':'XLV','MET':'XLF','META':'XLC','MGM':'XLY','MKC':'XLP','MLM':'XLB','MMC':'XLF','MMM':'XLI','MNST':'XLP','MO':'XLP','MOH':'XLV','MPC':'XLE','MPWR':'XLK','MRK':'XLV','MRO':'XLE','MS':'XLF','MSCI':'XLF','MSFT':'XLK','MTB':'XLF','MTD':'XLV','NDAQ':'XLF','NDSN':'XLI','NEE':'XLU','NEM':'XLB','NFLX':'XLC','NI':'XLU','NKE':'XLY','NOC':'XLI','NOW':'XLK','NSC':'XLI','NTAP':'XLK','NTRS':'XLF','NUE':'XLB','NVDA':'XLK','NWSA':'XLC','NXPI':'XLK','O':'XLRE','ODFL':'XLI','OKE':'XLE','OMC':'XLC','ON':'XLK','ORLY':'XLY','OTIS':'XLI','OXY':'XLE','PANW':'XLK','PARA':'XLC','PAYC':'XLK','PAYX':'XLI','PCAR':'XLI','PEG':'XLU','PEP':'XLP','PFE':'XLV','PG':'XLP','PGR':'XLF','PH':'XLI','PHM':'XLY','PKG':'XLB','PLD':'XLRE','PM':'XLP','PNC':'XLF','PNW':'XLU','PPG':'XLB','PPL':'XLU','PRU':'XLF','PSA':'XLRE','PSX':'XLE','PTC':'XLK','PWR':'XLI','PYPL':'XLF','QCOM':'XLK','RCL':'XLY','REG':'XLRE','REGN':'XLV','RF':'XLF','RL':'XLY','RMD':'XLV','ROK':'XLI','ROL':'XLI','ROP':'XLK','ROST':'XLY','RSG':'XLI','RTX':'XLI','SBUX':'XLY','SFM':'XLP','SHW':'XLB','SJM':'XLP','SLB':'XLE','SNA':'XLI','SNPS':'XLK','SO':'XLU','SPG':'XLRE','SPGI':'XLF','SRE':'XLU','STE':'XLV','STT':'XLF','STX':'XLK','STZ':'XLP','SWK':'XLI','SWKS':'XLK','SYF':'XLF','SYK':'XLV','SYY':'XLP','T':'XLC','TAP':'XLP','TDG':'XLI','TDY':'XLK','TER':'XLK','TFC':'XLF','TFX':'XLV','TJX':'XLY','TMO':'XLV','TMUS':'XLC','TPR':'XLY','TRGP':'XLE','TROW':'XLF','TRV':'XLF','TSCO':'XLP','TSLA':'XLY','TSN':'XLP','TTWO':'XLC','TXN':'XLK','TYL':'XLK','UDR':'XLRE','UHS':'XLV','ULTA':'XLY','UNH':'XLV','UNP':'XLI','UPS':'XLI','URI':'XLI','USB':'XLF','V':'XLF','VICI':'XLRE','VLO':'XLE','VMC':'XLB','VRSK':'XLI','VRSN':'XLK','VRTX':'XLV','VTR':'XLRE','VTRS':'XLV','VZ':'XLC','WAB':'XLI','WAT':'XLV','WBD':'XLC','WDC':'XLK','WEC':'XLU','WELL':'XLRE','WFC':'XLF','WM':'XLI','WMB':'XLE','WMT':'XLP','WRB':'XLF','WST':'XLV','WTW':'XLF','WYNN':'XLY','XEL':'XLU','XOM':'XLE','XYL':'XLI','YUM':'XLY','ZBRA':'XLK','ZBH':'XLV','ZTS':'XLV'
};

const SECTOR_NAMES = {
  'XLK':'Tech','XLF':'Financials','XLV':'Health','XLE':'Energy',
  'XLY':'Consumer D','XLP':'Consumer S','XLI':'Industrials',
  'XLB':'Materials','XLU':'Utilities','XLRE':'Real Estate','XLC':'Comm'
};

const VOL_AVG_PERIODS = 11;

// ── Proxies CORS ───────────────────────────────
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://soft-field-156f.miguel-gomez-anton.workers.dev/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
];

async function fetchOHLC(ticker) {
  // range=10y para tener suficientes datos mensuales para Stochastic(89)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10y&events=history`;
  for (const fn of PROXIES) {
    try {
      const r = await fetch(fn(url), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const text = await r.text();
      let j; try { j = JSON.parse(text); } catch { continue; }
      const res = j?.chart?.result?.[0];
      if (!res) continue;
      const q = res.indicators?.quote?.[0];
      if (!q) continue;
      const adj = res.indicators?.adjclose?.[0]?.adjclose || q.close;
      const ratio = adj.map((a,i) => (q.close[i] && a) ? a/q.close[i] : 1);
      return {
        timestamps: res.timestamp,
        opens: q.open.map((v,i) => v*ratio[i]),
        highs: q.high.map((v,i) => v*ratio[i]),
        lows: q.low.map((v,i) => v*ratio[i]),
        closes: adj, vols: q.volume
      };
    } catch (e) {}
  }
  throw new Error('Sin datos');
}

// ── Motor técnico ──────────────────────────────
function ema(arr, p) {
  const k = 2/(p+1), out = new Array(arr.length).fill(null);
  let s = arr.findIndex(v => v != null && !isNaN(v));
  if (s < 0) return out; out[s] = arr[s];
  for (let i = s+1; i < arr.length; i++) {
    const v = (arr[i] != null && !isNaN(arr[i])) ? arr[i] : out[i-1];
    out[i] = v*k + out[i-1]*(1-k);
  }
  return out;
}
function macd(closes) {
  const ef = ema(closes,12), es = ema(closes,26);
  const m = ef.map((v,i) => (v!=null&&es[i]!=null)?v-es[i]:null);
  return { m, sl: ema(m.map(v=>v??0),9) };
}
function rsi(closes, p=14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < p+1) return out;
  let g=0, l=0;
  for (let i=1; i<=p; i++) { const d=closes[i]-closes[i-1]; d>0?g+=d:l-=d; }
  let ag=g/p, al=l/p;
  out[p] = al===0?100:100-(100/(1+ag/al));
  for (let i=p+1; i<closes.length; i++) {
    const d=closes[i]-closes[i-1];
    ag=(ag*(p-1)+(d>0?d:0))/p; al=(al*(p-1)+(d<0?-d:0))/p;
    out[i]=al===0?100:100-(100/(1+ag/al));
  }
  return out;
}
function stoch(highs, lows, closes, p) {
  const rawK = closes.map((c,i) => {
    if (i<p-1) return null;
    const hh=Math.max(...highs.slice(i-p+1,i+1));
    const ll=Math.min(...lows.slice(i-p+1,i+1));
    return hh===ll?50:(c-ll)/(hh-ll)*100;
  });
  const k = ema(rawK,3);
  return { k, d: ema(k.map(v=>v??0),3) };
}
function resample(ts, opens, highs, lows, closes, vols, freq) {
  const groups = {};
  ts.forEach((t,i) => {
    const dd = new Date(t*1000);
    let key;
    if (freq==='W') {
      const day=dd.getDay(), diff=dd.getDate()-day+(day===0?-6:1);
      const mo=new Date(+dd); mo.setDate(diff);
      key=mo.toISOString().slice(0,10);
    } else {
      key=`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`;
    }
    if (!groups[key]) groups[key]={o:opens[i],h:highs[i],l:lows[i],c:closes[i],v:vols[i]};
    else { groups[key].h=Math.max(groups[key].h,highs[i]); groups[key].l=Math.min(groups[key].l,lows[i]); groups[key].c=closes[i]; groups[key].v+=vols[i]; }
  });
  const keys=Object.keys(groups).sort();
  return { dates:keys, opens:keys.map(k=>groups[k].o), highs:keys.map(k=>groups[k].h), lows:keys.map(k=>groups[k].l), closes:keys.map(k=>groups[k].c), vols:keys.map(k=>groups[k].v) };
}

function analyzeAsset(raw) {
  const {timestamps,opens,highs,lows,closes,vols}=raw;
  const n=closes.length;
  const lastVol=vols[n-1]||0;
  const avgVol11=vols.slice(-VOL_AVG_PERIODS).reduce((a,b)=>a+(b||0),0)/VOL_AVG_PERIODS;

  const W=resample(timestamps,opens,highs,lows,closes,vols,'W');
  const M=resample(timestamps,opens,highs,lows,closes,vols,'M');
  const mi=M.closes.length-1, wi=W.closes.length-1, di=n-1;

  const m_macd=macd(M.closes), m_s89=stoch(M.highs,M.lows,M.closes,89);
  const m_s8=stoch(M.highs,M.lows,M.closes,8), m_rsi=rsi(M.closes,14);
  const m_ema10=ema(M.closes,10);
  const w_macd=macd(W.closes), w_s89=stoch(W.highs,W.lows,W.closes,89);
  const w_rsi=rsi(W.closes,14), w_ema20=ema(W.closes,20);
  const d_macd=macd(closes), d_rsi=rsi(closes,14);

  const mc_ok=[
    m_macd.m[mi]>0&&m_macd.m[mi]>m_macd.sl[mi],
    (m_s89.k[mi]>80&&m_s89.k[mi]>m_s89.d[mi])||m_s89.k[mi]>92,
    m_rsi[mi]>65, m_s8.k[mi]>78,
    m_ema10[mi]&&M.closes[mi]>m_ema10[mi]
  ];
  const sc_ok=[
    w_macd.m[wi]>0&&w_macd.m[wi]>w_macd.sl[wi],
    (w_s89.k[wi]>85&&w_s89.k[wi]>w_s89.d[wi])||w_s89.k[wi]>92,
    w_rsi[wi]>67, w_ema20[wi]&&W.closes[wi]>w_ema20[wi]
  ];

  const mensualOk=mc_ok.every(x=>x), semanalOk=sc_ok.every(x=>x);
  const dailyReady=d_macd.m[di]>d_macd.sl[di]&&d_macd.m[di-1]<=d_macd.sl[di-1]&&d_rsi[di]>57&&d_macd.m[di]>0;

  // Score sobre 10: 5 mensuales + 4 semanales + 1 diaria (igual que el original)
  const score=mc_ok.filter(x=>x).length + sc_ok.filter(x=>x).length + (dailyReady?1:0);

  let estado='watching';
  if (mensualOk&&semanalOk&&dailyReady) estado='ready';
  else if (mensualOk&&semanalOk) estado='diario';
  else if (score>=7) estado='close';

  return { score, estado, price: closes[di], lastVol, avgVol11 };
}

// ── RENDER ─────────────────────────────────────
export async function render(container, { actionsSlot }) {
  // Estado por índice — independiente para cada pestaña
  const indexState = {};
  INDICES_CONFIG.forEach(cfg => {
    indexState[cfg.key] = { results: [], scanning: false, done: 0, total: 0 };
  });
  let activeTab = 'SP500';

  actionsSlot.innerHTML = '';

  container.innerHTML = `
    <div class="sc2-wrap">
      <div class="sc2-tabs" id="sc2-tabs">
        ${INDICES_CONFIG.map((cfg,i) => `
          <button class="sc2-tab ${i===0?'active':''}" data-index="${cfg.key}">
            ${cfg.flag} ${cfg.label}
            <span class="sc2-tab-badge" id="badge-${cfg.key}" style="display:none"></span>
          </button>
        `).join('')}
      </div>

      ${INDICES_CONFIG.map((cfg,i) => `
        <div class="sc2-panel ${i===0?'active':''}" id="panel-${cfg.key}">
          <div class="sc2-toolbar">
            <div class="sc2-filters">
              <div class="sc2-filter"><label>SCORE MÍN.</label>
                <select id="fs-${cfg.key}" class="sc2-sel">
                  <option value="9">≥ 9</option>
                  <option value="8">≥ 8</option>
                  <option value="7" selected>≥ 7</option>
                  <option value="6">≥ 6</option>
                  <option value="5">≥ 5</option>
                  <option value="0">Todos</option>
                </select>
              </div>
              <div class="sc2-filter"><label>VOLUMEN</label>
                <select id="fv-${cfg.key}" class="sc2-sel">
                  <option value="0">Cualquiera</option>
                  <option value="500000">› 500k</option>
                  <option value="990000" selected>› 990k</option>
                  <option value="2000000">› 2M</option>
                  <option value="5000000">› 5M</option>
                </select>
              </div>
              <div class="sc2-filter"><label>ESTADO</label>
                <select id="fe-${cfg.key}" class="sc2-sel">
                  <option value="all">Todos</option>
                  <option value="ready">🟢 Ready</option>
                  <option value="diario">🟡 Espera diario</option>
                  <option value="close">🔵 Cerca</option>
                </select>
              </div>
              <div class="sc2-filter"><label>SECTOR</label>
                <select id="fsec-${cfg.key}" class="sc2-sel">
                  <option value="all">Todos</option>
                  <option value="XLK">Tech</option>
                  <option value="XLF">Financials</option>
                  <option value="XLV">Health</option>
                  <option value="XLE">Energy</option>
                  <option value="XLY">Consumer D</option>
                  <option value="XLP">Consumer S</option>
                  <option value="XLI">Industrials</option>
                  <option value="XLB">Materials</option>
                  <option value="XLU">Utilities</option>
                  <option value="XLRE">Real Estate</option>
                  <option value="XLC">Comm</option>
                </select>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="sc2-status" id="st-${cfg.key}"></span>
              <button class="sc2-btn-scan" id="btn-${cfg.key}" data-index="${cfg.key}">▶ Escanear</button>
            </div>
          </div>

          <div class="sc2-progress" id="prog-${cfg.key}" style="display:none">
            <div class="sc2-progress-fill" id="progfill-${cfg.key}"></div>
          </div>

          <div id="res-${cfg.key}">
            <div class="sc2-empty">Pulsa Escanear para analizar ${(TICKERS[cfg.key]||[]).length} valores</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // ── Render tabla de resultados ──────────────
  // Escribe en localStorage sin importar el módulo (evita dependencias circulares)
  function addToWatchlistLocal(ticker) {
    try {
      const list = JSON.parse(localStorage.getItem('ethan_watchlist_v1') || '[]');
      if (!list.includes(ticker)) {
        list.push(ticker);
        localStorage.setItem('ethan_watchlist_v1', JSON.stringify(list));
      }
      // Feedback visual breve en el botón
      const btn = document.querySelector(`[data-wl="${ticker}"]`);
      if (btn) { btn.textContent = '✓'; btn.style.color = 'var(--green)'; btn.disabled = true; }
    } catch (e) {}
  }

  function renderTable(indexKey) {
    const state = indexState[indexKey];
    const minScore = parseInt(document.getElementById(`fs-${indexKey}`)?.value || '7');
    const minVol   = parseInt(document.getElementById(`fv-${indexKey}`)?.value || '0');
    const filterEstado = document.getElementById(`fe-${indexKey}`)?.value || 'all';
    const filterSector = document.getElementById(`fsec-${indexKey}`)?.value || 'all';

    const filtered = state.results.filter(r => {
      if (r.score < minScore) return false;
      if (minVol > 0 && r.avgVol11 < minVol) return false;
      if (filterEstado !== 'all' && r.estado !== filterEstado) return false;
      if (filterSector !== 'all' && r.sector !== filterSector) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    const el = document.getElementById(`res-${indexKey}`);
    if (!el) return;

    // Badge en la pestaña
    const badge = document.getElementById(`badge-${indexKey}`);
    const readyCount = state.results.filter(r => r.estado === 'ready').length;
    if (badge) {
      if (state.results.length > 0) {
        badge.style.display = 'inline';
        badge.textContent = readyCount > 0 ? readyCount : state.results.length;
        badge.style.background = readyCount > 0 ? 'var(--green)' : 'var(--text3)';
      } else {
        badge.style.display = 'none';
      }
    }

    if (filtered.length === 0) {
      el.innerHTML = `<div class="sc2-empty">${state.results.length > 0 ? 'Ningún valor cumple los filtros actuales' : 'Sin datos todavía — pulsa Escanear'}</div>`;
      return;
    }

    const estadoLabel = { ready:'🟢 LISTO', diario:'⏳ ESPERA DIARIO', close:'🔶 CERCA', watching:'👁 VIGILANDO' };
    const scoreColor  = s => s >= 9 ? 'var(--green)' : s >= 7 ? 'var(--amber)' : 'var(--text3)';

    el.innerHTML = `
      <table class="sc2-table">
        <thead>
          <tr>
            <th>TICKER</th><th>SECTOR</th><th>SCORE</th><th>ESTADO</th>
            <th>PRECIO</th><th>VOL MEDIA 11s</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td class="sc2-ticker">${r.ticker}</td>
              <td class="sc2-sector">${r.sector ? SECTOR_NAMES[r.sector] : '—'}</td>
              <td class="sc2-score" style="color:${scoreColor(r.score)}">${r.score}/10</td>
              <td style="color:${r.estado==='ready'?'var(--green)':r.estado==='diario'?'var(--amber)':'var(--text3)'}">${estadoLabel[r.estado]||'—'}</td>
              <td class="sc2-price">${r.price ? r.price.toFixed(2) : '—'}</td>
              <td class="sc2-vol">${r.avgVol11 >= 1e6 ? (r.avgVol11/1e6).toFixed(1)+'M' : Math.round(r.avgVol11/1e3)+'k'}</td>
              <td><button class="sc2-wl-btn" data-wl="${r.ticker}">+ WL</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Listener de botones watchlist
    el.querySelectorAll('.sc2-wl-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        addToWatchlistLocal(btn.dataset.wl);
      });
    });
  }

  // ── Escaneo ────────────────────────────────
  async function startScan(indexKey) {
    const state = indexState[indexKey];
    if (state.scanning) return;

    state.scanning = true;
    state.results = [];
    state.done = 0;

    const tickers = TICKERS[indexKey] || [];
    state.total = tickers.length;

    const btn  = document.getElementById(`btn-${indexKey}`);
    const st   = document.getElementById(`st-${indexKey}`);
    const prog = document.getElementById(`prog-${indexKey}`);
    const fill = document.getElementById(`progfill-${indexKey}`);

    if (btn)  { btn.disabled = true; btn.textContent = '⏳ Escaneando...'; }
    if (prog) prog.style.display = 'block';
    if (fill) fill.style.width = '0%';

    const BATCH = 8;
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH);
      const batchRes = await Promise.all(batch.map(async ticker => {
        try {
          const raw = await fetchOHLC(ticker);
          const result = analyzeAsset(raw);
          result.ticker = ticker;
          result.sector = SECTOR_MAP[ticker] || null;
          return result;
        } catch { return null; }
      }));

      batchRes.forEach(r => { if (r) state.results.push(r); });
      state.done += batch.length;

      const pct = (state.done / state.total * 100).toFixed(1);
      if (fill) fill.style.width = pct + '%';
      if (st)   st.textContent = `${tickers[Math.min(i+BATCH-1, tickers.length-1)]} (${state.done}/${state.total})`;

      if (activeTab === indexKey) renderTable(indexKey);
      await new Promise(r => setTimeout(r, 250));
    }

    state.scanning = false;
    if (btn)  { btn.disabled = false; btn.textContent = '↻ Re-escanear'; }
    if (prog) prog.style.display = 'none';
    if (st)   st.textContent = `${state.results.length} valores · ${state.results.filter(r=>r.estado==='ready').length} listos`;
    renderTable(indexKey);
  }

  // ── Event listeners ─────────────────────────
  container.querySelectorAll('.sc2-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.index;
      activeTab = key;
      container.querySelectorAll('.sc2-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.sc2-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${key}`)?.classList.add('active');
      renderTable(key);
    });
  });

  container.querySelectorAll('.sc2-btn-scan').forEach(btn => {
    btn.addEventListener('click', () => startScan(btn.dataset.index));
  });

  INDICES_CONFIG.forEach(cfg => {
    [`fs-${cfg.key}`,`fv-${cfg.key}`,`fe-${cfg.key}`,`fsec-${cfg.key}`].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => renderTable(cfg.key));
    });
  });

  return { destroy() {} };
}
