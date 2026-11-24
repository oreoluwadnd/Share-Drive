// The web front page, in Apple's design language: a translucent bar, centred headlines, blue pill buttons and
// "Learn more ›" links, big photos, white and #F5F5F7 bands with rounded tiles, and a black results band.
// Every number comes from docs/fairness-audit.md (UAH-DriveSet, 6 drivers, 37 scored trips).
// The photos in assets/landing were generated with Gemini.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentRef, ReactNode, useRef, useState } from 'react';
import { Image, ImageSourcePropType, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextStyle, useWindowDimensions, View } from 'react-native';

import { Moment } from './fairdrive';
import { ScoreRing } from './motion';
import { PHOTOS } from './photos';
import { MomentRow } from './score';
import { T } from './theme';
import { IconName, ui } from './ui';

const A = {
  white: '#FFFFFF', grey: '#F5F5F7', text: '#1D1D1F', secondary: '#6E6E73', hairline: '#D2D2D7',
  blue: '#0071E3', link: '#0066CC', black: '#000000', onBlack: '#F5F5F7', onBlackSecondary: '#86868B',
};
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const WIDE = 834;
const SAMPLE_MOMENTS: Moment[] = [
  { kind: 'hard_brake', label: 'Hard braking', count: 3, normal: 1.2 },
  { kind: 'hard_accel', label: 'Sharp speeding up', count: 1, normal: 1.6 },
  { kind: 'hard_corner', label: 'Sharp turns', count: 2, normal: 2.4 },
];

export default function Landing({ onAdmin }: { onAdmin: () => void }) {
  const wide = useWindowDimensions().width >= WIDE;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const anchors = useRef<Record<string, number>>({});
  const mark = (anchor: string) => (e: LayoutChangeEvent) => { anchors.current[anchor] = e.nativeEvent.layout.y; };
  const goTo = (anchor: string) => scroll.current?.scrollTo({ y: Math.max(0, anchors.current[anchor] - 48), animated: true });

  return (
    <View style={s.root}>
      <ScrollView ref={scroll} stickyHeaderIndices={[0]}>
        <Nav wide={wide} goTo={goTo} onAdmin={onAdmin} />
        <Hero wide={wide} onHow={() => goTo('how')} onAdmin={onAdmin} />
        <View onLayout={mark('roads')}><Roads wide={wide} /></View>
        <View onLayout={mark('how')}><HowItWorks wide={wide} /></View>
        <TheApp wide={wide} />
        <View onLayout={mark('scores')}><TwoScores wide={wide} /></View>
        <View onLayout={mark('results')}><Results wide={wide} /></View>
        <View onLayout={mark('privacy')}><Privacy wide={wide} /></View>
        <FinalCall wide={wide} onHow={() => goTo('how')} onAdmin={onAdmin} />
        <Footer onAdmin={onAdmin} />
      </ScrollView>
    </View>
  );
}

function Nav({ wide, goTo, onAdmin }: { wide: boolean; goTo: (anchor: string) => void; onAdmin: () => void }) {
  return (
    <View style={s.nav}>
      <View style={[s.content, s.navRow]}>
        <Text style={s.wordmark}>FairDrive</Text>
        {wide && (
          <View style={s.navLinks}>
            {[['How it works', 'how'], ['Two scores', 'scores'], ['Results', 'results'], ['Privacy', 'privacy']].map(([label, anchor]) => (
              <Pressable key={anchor} onPress={() => goTo(anchor)}>
                {({ hovered }: { pressed: boolean; hovered?: boolean }) => <Text style={[s.navLink, hovered && s.navLinkHover]}>{label}</Text>}
              </Pressable>
            ))}
          </View>
        )}
        <Pill label="Admin login" small onPress={onAdmin} />
      </View>
    </View>
  );
}

function Hero({ wide, onHow, onAdmin }: { wide: boolean; onHow: () => void; onAdmin: () => void }) {
  return (
    <View style={[s.band, s.heroBand]}>
      <View style={[s.content, s.centered, s.heroText]}>
        <Text style={s.eyebrow}>FairDrive</Text>
        <Text style={[s.h1, !wide && s.h1Narrow]}>Scored on your driving.{'\n'}Not on your roads.</Text>
        <Text style={[s.lead, s.centerText]}>
          Busy streets need more braking than an open highway. FairDrive compares every trip with what's normal for its roads, light and weather.
        </Text>
        <View style={s.actions}>
          <Pill label="See how it works" onPress={onHow} />
          <More label="Admin login" onPress={onAdmin} />
        </View>
      </View>
      {/* Cropped wider than the file on big screens (less sky), and taller on phones (a bigger car). */}
      <Photo source={PHOTOS.road} ratio={wide ? 2.2 : 1.1} maxWidth={1440} label="A small silver car driving down a country road through autumn trees" />
    </View>
  );
}

function Roads({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.grey]}>
      <View style={s.content}>
        <Text style={[s.statement, !wide && s.statementNarrow]}>
          A trip through town needs more braking than a drive on the 401.{' '}
          <Text style={s.statementGrey}>Old scores call that bad driving. FairDrive calls it normal.</Text>
        </Text>
        <View style={[s.tiles, wide && s.row]}>
          <Tile wide={wide} eyebrow="Downtown at rush hour" title="Lots of braking is normal here." text="Stop-and-go traffic, lights and crossings. FairDrive expects it, so it doesn't count against you.">
            <Photo source={PHOTOS.city} ratio={1200 / 896} radius={18} label="Brake lights in city traffic at dusk, seen from the driver's seat" />
          </Tile>
          <Tile wide={wide} eyebrow="Open highway" title="Hardly any braking is normal here." text="A hard brake on a quiet highway stands out more, so it counts for more.">
            <Photo source={PHOTOS.highway} ratio={1200 / 896} radius={18} label="A wide, nearly empty highway under a blue sky" />
          </Tile>
        </View>
      </View>
    </View>
  );
}

function HowItWorks({ wide }: { wide: boolean }) {
  return (
    <View style={s.band}>
      <View style={s.content}>
        <Heading title="How it works." rest="From your drive to a fair score, with just a phone." />
        <View style={[s.tiles, wide && s.row]}>
          <Tile wide={wide} grey eyebrow="Step 1" title="Mount your phone. Tap Start." text="It records how the car brakes, speeds up and turns, and where.">
            <Photo source={PHOTOS.mount} ratio={1600 / 1195} radius={18} label="A phone in a dashboard mount, on a tree-lined street" />
          </Tile>
          <Tile wide={wide} grey eyebrow="Step 2" title="FairDrive reads the conditions." text="Road types, speed limits, daylight and weather along your route.">
            <View style={s.conditions}>
              <Condition icon="road-variant" label="Main road" />
              <Condition icon="car-speed-limiter" label="50 km/h limit" />
              <Condition icon="weather-night" label="After dark" />
              <Condition icon="weather-rainy" label="Light rain" />
            </View>
          </Tile>
          <Tile wide={wide} grey eyebrow="Step 3" title="You get a fair score." text="Each kind of harsh moment, compared with what's normal on those roads.">
            <View style={s.moments}>
              {SAMPLE_MOMENTS.slice(0, 2).map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
            </View>
          </Tile>
        </View>
      </View>
    </View>
  );
}

function TheApp({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.grey]}>
      <View style={[s.content, wide ? s.appWide : s.appNarrow]}>
        <View style={wide ? s.flex : undefined}>
          <Text style={s.eyebrowSmall}>The FairDrive app</Text>
          <Text style={[s.h2, !wide && s.h2Narrow]}>Your score, a moment after you park.</Text>
          <View style={s.features}>
            <Feature icon="numeric-2-circle-outline" title="Two scores" text="One for your driving, one for how hard the conditions were." />
            <Feature icon="format-list-bulleted" title="Three plain reasons" text="What shaped the score, in words you can act on." />
            <Feature icon="chart-line" title="Progress over time" text="See which kinds of harsh moment are getting better." />
          </View>
        </View>
        <PhoneMock />
      </View>
    </View>
  );
}

function PhoneMock() {
  return (
    <View style={s.phone}>
      <View style={s.phoneScreen}>
        <View style={s.statusBar}>
          <Text style={s.statusText}>9:41</Text>
          <View style={s.island} />
          <View style={s.statusIcons}>
            <MaterialCommunityIcons name="signal-cellular-3" size={13} color={T.text} />
            <MaterialCommunityIcons name="battery-high" size={15} color={T.text} />
          </View>
        </View>
        <Text style={s.phoneTitle}>Your drive</Text>
        <View style={[ui.card, s.phoneCard]}>
          <LinearGradient colors={[`${T.ring.good[0]}22`, '#FFFFFF00']} style={StyleSheet.absoluteFill} />
          <ScoreRing value={72} colors={T.ring.good} word="Good" />
          <Text style={s.phoneHeadline}>Watch your braking</Text>
          <Text style={[ui.muted, ui.centerText]}>3 hard brakes where about 1 is normal here.</Text>
        </View>
        <View style={[ui.card, s.phoneMoments]}>
          {SAMPLE_MOMENTS.map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
        </View>
      </View>
    </View>
  );
}

function TwoScores({ wide }: { wide: boolean }) {
  return (
    <View style={s.band}>
      <View style={s.content}>
        <Heading title="Two scores." rest="One is yours. One is the road's." />
        <View style={[s.tiles, wide && s.row]}>
          <ScoreTile wide={wide} eyebrow="Yours to control" title="Driving score" value={72} color={T.ring.good}
            text="Your hard braking, sharp speeding up and sharp turns against what's normal for the trip. 50 is normal, 100 is none at all." />
          <ScoreTile wide={wide} eyebrow="Not your fault" title="Conditions score" value={64} color={T.ring.fair}
            text="How demanding the trip was: road types, speed limits, daylight and weather. 100 is the easiest kind of drive." />
        </View>
      </View>
    </View>
  );
}

function Results({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.black]}>
      <View style={s.content}>
        <Text style={[s.h2, s.onBlack, s.centerText, !wide && s.h2Narrow]}>The old score swings with the road.{'\n'}FairDrive doesn't.</Text>
        <Text style={[s.lead, s.onBlackSecondary, s.centerText]}>Average scores for the same drivers on different kinds of road.</Text>
        <View style={[s.tiles, wide && s.row]}>
          <GapTile wide={wide} title="Old score" gap="19-point gap" values={[70.1, 51.2]} color={T.ring.poor[0]} />
          <GapTile wide={wide} title="FairDrive" gap="1-point gap" values={[59.0, 57.7]} color={T.ring.good[0]} />
        </View>
        <View style={[s.stats, wide && s.row]}>
          <Stat value="93%" text="smaller score gap between road types than the old score" />
          <Stat value="22.6%" text="more accurate than a simple average, on drivers it had never seen" />
          <Stat value="500 m" text="hidden at the start and end of every trip" />
        </View>
        <Text style={[s.small, s.onBlackSecondary, s.centerText]}>Measured on UAH-DriveSet: 6 drivers, 37 trips, Spain. Ontario drives are next.</Text>
      </View>
    </View>
  );
}

function Privacy({ wide }: { wide: boolean }) {
  return (
    <View style={s.band}>
      <View style={[s.content, s.centered]}>
        <MaterialCommunityIcons name="lock" size={56} color={A.blue} />
        <Text style={[s.h2, s.centerText, !wide && s.h2Narrow]}>Privacy. Built in from the first metre.</Text>
        <Text style={[s.lead, s.centerText]}>A score is only fair if drivers can trust what happens to their data.</Text>
        <View style={[s.privacyRow, wide && s.row]}>
          <Point icon="home-lock-open" title="Home and work stay private" text="The first and last 500 m of every trip are cut before anything is saved." />
          <Point icon="database-off-outline" title="No raw sensor data kept" text="Only the cleaned trip is stored, never the phone's raw readings." />
          <Point icon="account-lock-outline" title="Only you see your trips" text="Each driver has an account and can delete it, with every trip, at any time." />
        </View>
      </View>
    </View>
  );
}

function FinalCall({ wide, onHow, onAdmin }: { wide: boolean; onHow: () => void; onAdmin: () => void }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={[s.band, s.grey]}>
      <View style={s.content} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[s.final, { height: Math.max(460, width * 0.5) }]}>
          <Image source={PHOTOS.dusk} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="An empty highway at dusk" />
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)']} style={StyleSheet.absoluteFill} />
          <View style={[s.centered, s.finalText]}>
            <Text style={[s.h2, s.onBlack, s.centerText, !wide && s.h2Narrow]}>Drive. Stop.{'\n'}See your fair score.</Text>
            <View style={s.actions}>
              <Pill label="See how it works" onPress={onHow} />
              <More label="Admin login" onPress={onAdmin} light />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function Footer({ onAdmin }: { onAdmin: () => void }) {
  return (
    <View style={[s.grey, s.footer]}>
      <View style={[s.content, s.footerInner]}>
        <Text style={s.footerText}>FairDrive is a student project, 2026. Scores tested on UAH-DriveSet; Ontario drives in progress.</Text>
        <View style={s.footerRule} />
        <View style={s.footerRow}>
          <Text style={s.footerText}>Photos generated with Gemini.</Text>
          <Pressable onPress={onAdmin}><Text style={[s.footerText, s.footerLink]}>Admin login</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

// Pieces

/** A photo that keeps its shape at any width. The browser otherwise sizes an image from the file, not the layout. */
function Photo({ source, ratio, radius = 0, maxWidth, label }: { source: ImageSourcePropType; ratio: number; radius?: number; maxWidth?: number; label: string }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={[s.photoBox, maxWidth ? { maxWidth } : null]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <Image source={source} style={{ width, height: width / ratio, borderRadius: radius }} resizeMode="cover" accessibilityLabel={label} />}
    </View>
  );
}

const Heading = ({ title, rest }: { title: string; rest: string }) => (
  <Text style={s.heading}>{title} <Text style={s.headingGrey}>{rest}</Text></Text>
);

function Tile(p: { wide: boolean; grey?: boolean; eyebrow: string; title: string; text: string; children: ReactNode }) {
  return (
    <View style={[s.tile, p.grey && s.tileGrey, p.wide && s.flex]}>
      <Text style={s.tileEyebrow}>{p.eyebrow}</Text>
      <Text style={s.tileTitle}>{p.title}</Text>
      <Text style={s.tileText}>{p.text}</Text>
      <View style={s.tileVisual}>{p.children}</View>
    </View>
  );
}

const Condition = ({ icon, label }: { icon: IconName; label: string }) => (
  <View style={s.condition}>
    <MaterialCommunityIcons name={icon} size={22} color={A.blue} />
    <Text style={s.conditionText}>{label}</Text>
  </View>
);

const Feature = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
  <View style={s.feature}>
    <MaterialCommunityIcons name={icon} size={28} color={A.blue} />
    <View style={s.flex}>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.tileText}>{text}</Text>
    </View>
  </View>
);

const ScoreTile = (p: { wide: boolean; eyebrow: string; title: string; value: number; color: readonly [string, string]; text: string }) => (
  <View style={[s.tile, s.tileGrey, p.wide && s.flex]}>
    <Text style={s.tileEyebrow}>{p.eyebrow}</Text>
    <Text style={s.tileTitle}>{p.title}</Text>
    <Text style={[s.scoreValue, { color: p.color[0] }]}>{p.value}</Text>
    <Text style={s.tileText}>{p.text}</Text>
  </View>
);

const GapTile = ({ wide, title, gap, values, color }: { wide: boolean; title: string; gap: string; values: [number, number]; color: string }) => (
  <View style={[s.darkTile, wide && s.flex]}>
    <View style={s.gapHead}>
      <Text style={[s.tileTitle, s.onBlack]}>{title}</Text>
      <Text style={[s.gapLabel, { color }]}>{gap}</Text>
    </View>
    {(['Mostly highway', 'Other roads'] as const).map((label, i) => (
      <View key={label} style={s.bar}>
        <View style={s.barLabels}>
          <Text style={[s.small, s.onBlackSecondary]}>{label}</Text>
          <Text style={[s.small, s.onBlack, s.barValue]}>{values[i].toFixed(0)}</Text>
        </View>
        <View style={s.barTrack}><View style={[s.barFill, { width: `${values[i]}%`, backgroundColor: color }]} /></View>
      </View>
    ))}
  </View>
);

const Stat = ({ value, text }: { value: string; text: string }) => (
  <View style={s.stat}>
    <Text style={s.statValue}>{value}</Text>
    <Text style={[s.small, s.onBlackSecondary, s.centerText, s.statText]}>{text}</Text>
  </View>
);

const Point = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
  <View style={s.point}>
    <MaterialCommunityIcons name={icon} size={30} color={A.text} />
    <Text style={[s.featureTitle, s.centerText]}>{title}</Text>
    <Text style={[s.tileText, s.centerText]}>{text}</Text>
  </View>
);

function Pill({ label, small, onPress }: { label: string; small?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.pill, small && s.pillSmall, hovered && s.pillHover]}>
      <Text style={[s.pillText, small && s.pillTextSmall]}>{label}</Text>
    </Pressable>
  );
}

function More({ label, light, onPress }: { label: string; light?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <Text style={[s.more, light && s.moreLight, hovered && s.moreHover]}>{label} ›</Text>
      )}
    </Pressable>
  );
}

const f = (style: TextStyle): TextStyle => ({ fontFamily: FONT, color: A.text, ...style });

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: A.white },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: 22 },
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  band: { backgroundColor: A.white, paddingVertical: 96, gap: 56 },
  heroBand: { paddingTop: 64 },
  grey: { backgroundColor: A.grey },
  black: { backgroundColor: A.black },
  onBlack: { color: A.onBlack },
  onBlackSecondary: { color: A.onBlackSecondary },

  nav: {
    height: 52, justifyContent: 'center', backgroundColor: 'rgba(251,251,253,0.8)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.16)', backdropFilter: 'saturate(180%) blur(20px)',
  } as object,
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: f({ fontSize: 21, fontWeight: '600', letterSpacing: 0.2 }),
  navLinks: { flexDirection: 'row', gap: 32 },
  navLink: f({ fontSize: 13, opacity: 0.8 }),
  navLinkHover: { opacity: 1 },

  heroText: { gap: 18 },
  eyebrow: f({ fontSize: 24, fontWeight: '600' }),
  h1: f({ fontSize: 80, lineHeight: 84, fontWeight: '600', letterSpacing: -1.6, textAlign: 'center' }),
  h1Narrow: { fontSize: 44, lineHeight: 48, letterSpacing: -0.8 },
  lead: f({ fontSize: 21, lineHeight: 30, color: A.secondary, maxWidth: 680, alignSelf: 'center' }),
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 10 },
  photoBox: { width: '100%', alignSelf: 'center' },

  statement: f({ fontSize: 48, lineHeight: 56, fontWeight: '600', letterSpacing: -0.8, marginBottom: 56 }),
  statementNarrow: { fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  statementGrey: { color: A.secondary },
  heading: f({ fontSize: 40, lineHeight: 46, fontWeight: '600', letterSpacing: -0.5, marginBottom: 40 }),
  headingGrey: { color: A.secondary },
  h2: f({ fontSize: 56, lineHeight: 62, fontWeight: '600', letterSpacing: -1, marginBottom: 14 }),
  h2Narrow: { fontSize: 36, lineHeight: 42, letterSpacing: -0.5 },
  eyebrowSmall: f({ fontSize: 17, fontWeight: '600', color: A.secondary, marginBottom: 10 }),
  small: f({ fontSize: 14, lineHeight: 20 }),

  tiles: { gap: 20 },
  tile: { backgroundColor: A.white, borderRadius: 28, padding: 32, gap: 8 },
  tileGrey: { backgroundColor: A.grey },
  tileEyebrow: f({ fontSize: 12, fontWeight: '600', color: A.secondary, textTransform: 'uppercase', letterSpacing: 0.6 }),
  tileTitle: f({ fontSize: 28, lineHeight: 32, fontWeight: '600', letterSpacing: -0.3 }),
  tileText: f({ fontSize: 17, lineHeight: 25, color: A.secondary }),
  tileVisual: { marginTop: 20 },

  conditions: { gap: 10 },
  condition: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: A.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  conditionText: f({ fontSize: 17, fontWeight: '500' }),
  moments: { backgroundColor: A.white, borderRadius: 18, paddingHorizontal: 16 },

  appWide: { flexDirection: 'row', alignItems: 'center', gap: 64 },
  appNarrow: { gap: 48, alignItems: 'center' },
  features: { gap: 28, marginTop: 20 },
  feature: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  featureTitle: f({ fontSize: 19, fontWeight: '600', marginBottom: 2 }),

  phone: { width: 320, height: 640, borderRadius: 54, backgroundColor: '#1D1D1F', padding: 11, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 40, shadowOffset: { width: 0, height: 24 } },
  phoneScreen: { flex: 1, borderRadius: 44, overflow: 'hidden', backgroundColor: T.background[0], paddingHorizontal: 14, gap: 10 },
  statusBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  statusText: { color: T.text, fontSize: 14, fontWeight: '700' },
  island: { width: 92, height: 26, borderRadius: 13, backgroundColor: '#1D1D1F' },
  statusIcons: { flexDirection: 'row', gap: 4 },
  phoneTitle: { color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, paddingHorizontal: 4 },
  phoneCard: { alignItems: 'center', overflow: 'hidden', paddingVertical: 14, gap: 4 },
  phoneHeadline: { color: T.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  phoneMoments: { paddingVertical: 4, paddingHorizontal: 14 },

  scoreValue: f({ fontSize: 96, lineHeight: 104, fontWeight: '600', letterSpacing: -3, marginVertical: 8, fontVariant: ['tabular-nums'] }),

  darkTile: { backgroundColor: '#1D1D1F', borderRadius: 28, padding: 32, gap: 20 },
  gapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gapLabel: f({ fontSize: 17, fontWeight: '600' }),
  bar: { gap: 8 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barValue: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#333336' },
  barFill: { height: 8, borderRadius: 4 },
  stats: { gap: 40, marginVertical: 24 },
  stat: { flex: 1, alignItems: 'center', gap: 8 },
  statValue: f({ fontSize: 64, lineHeight: 70, fontWeight: '600', letterSpacing: -1.5, color: A.onBlack }),
  statText: { maxWidth: 240 },

  privacyRow: { gap: 40, marginTop: 40 },
  point: { flex: 1, alignItems: 'center', gap: 10 },

  final: { borderRadius: 28, overflow: 'hidden', justifyContent: 'center' },
  finalText: { paddingHorizontal: 24 },

  pill: { backgroundColor: A.blue, borderRadius: 980, paddingHorizontal: 22, paddingVertical: 12 },
  pillSmall: { paddingHorizontal: 14, paddingVertical: 6 },
  pillHover: { backgroundColor: '#0077ED' },
  pillText: f({ color: '#FFFFFF', fontSize: 17, fontWeight: '400' }),
  pillTextSmall: { fontSize: 13 },
  more: f({ color: A.link, fontSize: 17 }),
  moreLight: { color: '#FFFFFF' },
  moreHover: { textDecorationLine: 'underline' },

  footer: { paddingVertical: 28 },
  footerInner: { gap: 12 },
  footerRule: { height: StyleSheet.hairlineWidth, backgroundColor: A.hairline },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  footerText: f({ fontSize: 12, lineHeight: 16, color: A.secondary }),
  footerLink: { color: A.text },
});
