export interface Country {
  iso: string
  name: string
  dial: string
  flag: string
}

const flagEmoji = (iso: string) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

const DATA = `AF|Afghanistan|93
AL|Albania|355
DZ|Algeria|213
AS|American Samoa|1684
AD|Andorra|376
AO|Angola|244
AI|Anguilla|1264
AG|Antigua and Barbuda|1268
AR|Argentina|54
AM|Armenia|374
AW|Aruba|297
AU|Australia|61
AT|Austria|43
AZ|Azerbaijan|994
BS|Bahamas|1242
BH|Bahrain|973
BD|Bangladesh|880
BB|Barbados|1246
BY|Belarus|375
BE|Belgium|32
BZ|Belize|501
BJ|Benin|229
BM|Bermuda|1441
BT|Bhutan|975
BO|Bolivia|591
BA|Bosnia and Herzegovina|387
BW|Botswana|267
BR|Brazil|55
IO|British Indian Ocean Territory|246
BN|Brunei|673
BG|Bulgaria|359
BF|Burkina Faso|226
BI|Burundi|257
KH|Cambodia|855
CM|Cameroon|237
CA|Canada|1
CV|Cabo Verde|238
KY|Cayman Islands|1345
CF|Central African Republic|236
TD|Chad|235
CL|Chile|56
CN|China|86
CX|Christmas Island|61
CC|Cocos (Keeling) Islands|61
CO|Colombia|57
KM|Comoros|269
CG|Congo|242
CD|Congo (DRC)|243
CK|Cook Islands|682
CR|Costa Rica|506
CI|Côte d'Ivoire|225
HR|Croatia|385
CU|Cuba|53
CW|Curaçao|599
CY|Cyprus|357
CZ|Czechia|420
DK|Denmark|45
DJ|Djibouti|253
DM|Dominica|1767
DO|Dominican Republic|1809
EC|Ecuador|593
EG|Egypt|20
SV|El Salvador|503
GQ|Equatorial Guinea|240
ER|Eritrea|291
EE|Estonia|372
SZ|Eswatini|268
ET|Ethiopia|251
FK|Falkland Islands|500
FO|Faroe Islands|298
FJ|Fiji|679
FI|Finland|358
FR|France|33
GF|French Guiana|594
PF|French Polynesia|689
GA|Gabon|241
GM|Gambia|220
GE|Georgia|995
DE|Germany|49
GH|Ghana|233
GI|Gibraltar|350
GR|Greece|30
GL|Greenland|299
GD|Grenada|1473
GP|Guadeloupe|590
GU|Guam|1671
GT|Guatemala|502
GG|Guernsey|44
GN|Guinea|224
GW|Guinea-Bissau|245
GY|Guyana|592
HT|Haiti|509
VA|Vatican City|379
HN|Honduras|504
HK|Hong Kong|852
HU|Hungary|36
IS|Iceland|354
IN|India|91
ID|Indonesia|62
IR|Iran|98
IQ|Iraq|964
IE|Ireland|353
IM|Isle of Man|44
IL|Israel|972
IT|Italy|39
JM|Jamaica|1876
JP|Japan|81
JE|Jersey|44
JO|Jordan|962
KZ|Kazakhstan|7
KE|Kenya|254
KI|Kiribati|686
KP|North Korea|850
KR|South Korea|82
KW|Kuwait|965
KG|Kyrgyzstan|996
LA|Laos|856
LV|Latvia|371
LB|Lebanon|961
LS|Lesotho|266
LR|Liberia|231
LY|Libya|218
LI|Liechtenstein|423
LT|Lithuania|370
LU|Luxembourg|352
MO|Macao|853
MG|Madagascar|261
MW|Malawi|265
MY|Malaysia|60
MV|Maldives|960
ML|Mali|223
MT|Malta|356
MH|Marshall Islands|692
MQ|Martinique|596
MR|Mauritania|222
MU|Mauritius|230
YT|Mayotte|262
MX|Mexico|52
FM|Micronesia|691
MD|Moldova|373
MC|Monaco|377
MN|Mongolia|976
ME|Montenegro|382
MS|Montserrat|1664
MA|Morocco|212
MZ|Mozambique|258
MM|Myanmar|95
NA|Namibia|264
NR|Nauru|674
NP|Nepal|977
NL|Netherlands|31
NC|New Caledonia|687
NZ|New Zealand|64
NI|Nicaragua|505
NE|Niger|227
NG|Nigeria|234
NU|Niue|683
NF|Norfolk Island|672
MK|North Macedonia|389
MP|Northern Mariana Islands|1670
NO|Norway|47
OM|Oman|968
PK|Pakistan|92
PW|Palau|680
PS|Palestine|970
PA|Panama|507
PG|Papua New Guinea|675
PY|Paraguay|595
PE|Peru|51
PH|Philippines|63
PL|Poland|48
PT|Portugal|351
PR|Puerto Rico|1787
QA|Qatar|974
RE|Réunion|262
RO|Romania|40
RU|Russia|7
RW|Rwanda|250
BL|Saint Barthélemy|590
SH|Saint Helena|290
KN|Saint Kitts and Nevis|1869
LC|Saint Lucia|1758
MF|Saint Martin|590
PM|Saint Pierre and Miquelon|508
VC|Saint Vincent and the Grenadines|1784
WS|Samoa|685
SM|San Marino|378
ST|São Tomé and Príncipe|239
SA|Saudi Arabia|966
SN|Senegal|221
RS|Serbia|381
SC|Seychelles|248
SL|Sierra Leone|232
SG|Singapore|65
SX|Sint Maarten|1721
SK|Slovakia|421
SI|Slovenia|386
SB|Solomon Islands|677
SO|Somalia|252
ZA|South Africa|27
SS|South Sudan|211
ES|Spain|34
LK|Sri Lanka|94
SD|Sudan|249
SR|Suriname|597
SE|Sweden|46
CH|Switzerland|41
SY|Syria|963
TW|Taiwan|886
TJ|Tajikistan|992
TZ|Tanzania|255
TH|Thailand|66
TL|Timor-Leste|670
TG|Togo|228
TK|Tokelau|690
TO|Tonga|676
TT|Trinidad and Tobago|1868
TN|Tunisia|216
TR|Turkey|90
TM|Turkmenistan|993
TC|Turks and Caicos Islands|1649
TV|Tuvalu|688
UG|Uganda|256
UA|Ukraine|380
AE|United Arab Emirates|971
GB|United Kingdom|44
US|United States|1
UY|Uruguay|598
UZ|Uzbekistan|998
VU|Vanuatu|678
VE|Venezuela|58
VN|Vietnam|84
VG|British Virgin Islands|1284
VI|U.S. Virgin Islands|1340
WF|Wallis and Futuna|681
EH|Western Sahara|212
YE|Yemen|967
ZM|Zambia|260
ZW|Zimbabwe|263
AX|Åland Islands|358`

export const COUNTRIES: Country[] = DATA.split('\n').map((line) => {
  const [iso, name, dial] = line.split('|')
  return { iso, name, dial, flag: flagEmoji(iso) }
})

export const DEFAULT_COUNTRY: Country = COUNTRIES.find((c) => c.iso === 'KE') ?? COUNTRIES[0]

/** The national subscriber length — digits after the dial code, trunk 0 excluded —
 *  for countries we know. PhoneInput caps typing at it and the forms validate to
 *  it; unlisted countries fall back to the SUBSCRIBER_MIN–MAX window. */
export const SUBSCRIBER_MIN = 7
export const SUBSCRIBER_MAX = 12
export const SUBSCRIBER_LENGTH: Record<string, number> = {
  // East Africa & neighbours — the branches' market.
  KE: 9, UG: 9, TZ: 9, RW: 9, BI: 8, SS: 9, ET: 9, SO: 9, DJ: 8, ER: 7, SD: 9, CD: 9,
  // Rest of Africa commonly seen at the desk.
  MW: 9, ZM: 9, ZW: 9, MZ: 9, BW: 8, NA: 9, ZA: 9, NG: 10, GH: 9, CM: 9, CI: 10, SN: 9,
  EG: 10, MA: 9, DZ: 9, TN: 8,
  // Common international.
  US: 10, CA: 10, GB: 10, IN: 10, PK: 10, CN: 11, JP: 10, AU: 9, AE: 9, SA: 9, QA: 8,
  KW: 8, IL: 9, TR: 10, ES: 9, NL: 9, BE: 9, SE: 9, NO: 8, DK: 8, RU: 10, MX: 10,
  AR: 10, IQ: 10, IR: 10,
}

/** The subscriber cap for a country's local input — exact where known. */
export const subscriberLength = (c: Country) => SUBSCRIBER_LENGTH[c.iso] ?? SUBSCRIBER_MAX

/** The country a "+dial…" value belongs to — longest matching dial code wins. */
export function dialCountry(value: string): Country | null {
  if (!value.startsWith('+')) return null
  const d = value.slice(1).replace(/\D/g, '')
  let best: Country | null = null
  for (const c of COUNTRIES) if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c
  return best
}

/** The subscriber digits as typed locally — a leading +dial code and the trunk 0 are
 *  stripped, so "+254795…" and "0795…" both reduce to "795…". */
export function localDigits(value: string): string {
  let d = value.replace(/\D/g, '')
  if (value.trim().startsWith('+')) {
    let best = ''
    for (const c of COUNTRIES) if (d.startsWith(c.dial) && c.dial.length > best.length) best = c.dial
    d = d.slice(best.length)
  }
  return d.replace(/^0+/, '')
}

/** The subscriber count `value` should hold — exact for a known country, else the
 *  realistic international window (SUBSCRIBER_MIN–MAX). */
export function expectedDigits(value: string): { min: number; max: number } {
  const len = SUBSCRIBER_LENGTH[(dialCountry(value) ?? DEFAULT_COUNTRY).iso]
  return len ? { min: len, max: len } : { min: SUBSCRIBER_MIN, max: SUBSCRIBER_MAX }
}

/** Whether the stored phone holds the correct number of subscriber digits for its
 *  country — e.g. exactly 9 under +254, not "at least 9 digits overall". */
export function phoneComplete(value: string): boolean {
  const n = localDigits(value).length
  const { min, max } = expectedDigits(value)
  return n >= min && n <= max
}

/** 20px-wide flag image; falls back to the flag emoji if it can't load. */
export const flagUrl = (iso: string) => `https://flagcdn.com/w20/${iso.toLowerCase()}.png`
