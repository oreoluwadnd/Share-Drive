// The web front page. Warm and bold, after Corgi and Superpower on Mobbin, written to the taste skill's rules
// (tasteskill.dev): a plain headline naming the product, one hard fact on the first screen, one idea per screen,
// flat colours (no glass, gradients or resting shadows), no eyebrow labels or step numbers, no captions under photos.
// Every number comes from docs/fairness-audit.md (UAH-DriveSet, 6 drivers, 37 scored trips). Photos: Gemini.

import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextStyle, useWindowDimensions, View } from 'react-native';

import { Moment } from './fairdrive';
import { ScoreRing } from './motion';
import { PHOTOS } from './photos';
import { MomentRow } from './score';
import { T } from './theme';
import { IconName, ui } from './ui';

const C = {
  paper: '#F6F2EA', surface: '#EDE6D9', white: '#FFFFFF', ink: '#17140F', muted: '#665F53', line: '#DDD5C6',
  green: '#137A41', greenHover: '#0F6A38', greenSoft: '#DDEEDD', amber: '#B45309', red: '#C2410C', onInk: '#F6F2EA', onInkMuted: '#A9A193',
};
const HEAD = 'BricolageGrotesque_700Bold';
const HEAD_SEMI = 'BricolageGrotesque_600SemiBold';
const BODY = 'DMSans_400Regular';
const BODY_MEDIUM = 'DMSans_500Medium';
const BODY_BOLD = 'DMSans_700Bold';
const WIDE = 900;
const SAMPLE_MOMENTS: Moment[] = [
  { kind: 'hard_brake', label: 'Hard braking', count: 3, normal: 1.2 },
  { kind: 'hard_accel', label: 'Sharp speeding up', count: 1, normal: 1.6 },
  { kind: 'hard_corner', label: 'Sharp turns', count: 2, normal: 2.4 },
];

export default function Landing({ onLogin }: { onLogin: () => void }) {
  const [fontsReady] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const wide = useWindowDimensions().width >= WIDE;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const anchors = useRef<Record<string, number>>({});
  const mark = (anchor: string) => (e: LayoutChangeEvent) => { anchors.current[anchor] = e.nativeEvent.layout.y; };
  const goTo = (anchor: string) => scroll.current?.scrollTo({ y: Math.max(0, anchors.current[anchor] - 64), animated: true });
  if (!fontsReady) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <ScrollView ref={scroll} stickyHeaderIndices={[0]}>
        <Nav wide={wide} goTo={goTo} onLogin={onLogin} />
        <Hero wide={wide} onHow={() => goTo('how')} onResults={() => goTo('results')} />
        <Roads wide={wide} />
        <View onLayout={mark('how')}><HowItWorks wide={wide} /></View>
        <TwoScores wide={wide} />
        <View onLayout={mark('results')}><Results wide={wide} /></View>
        <View onLayout={mark('privacy')}><Privacy wide={wide} /></View>
        <Close wide={wide} />
        <Footer goTo={goTo} onLogin={onLogin} />
      </ScrollView>
    </View>
  );
}

function Nav({ wide, goTo, onLogin }: { wide: boolean; goTo: (anchor: string) => void; onLogin: () => void }) {
  return (
    <View style={s.nav}>
      <View style={[s.content, s.navRow]}>
        <Wordmark />
        {wide && (
          <View style={s.navLinks}>
            {[['How it works', 'how'], ['Results', 'results'], ['Privacy', 'privacy']].map(([label, anchor]) => (
              <TextLink key={anchor} label={label} onPress={() => goTo(anchor)} />
            ))}
          </View>
        )}
        <Button label="Log in" dark small onPress={onLogin} />
      </View>
    </View>
  );
}

function Hero({ wide, onHow, onResults }: { wide: boolean; onHow: () => void; onResults: () => void }) {
  // The hero enters once on load; nothing else moves with the page.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [enter]);
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={[s.band, s.heroBand]}>
      <Animated.View style={[s.content, wide ? s.heroWide : s.heroNarrow, { opacity: enter, transform: [{ translateY: rise }] }]}>
        <View style={wide ? s.heroText : undefined}>
          <Text style={[s.h1, !wide && s.h1Narrow]}>Driving scores that adjust for your roads and weather</Text>
          <Text style={s.lead}>
            Mount your phone and drive. FairDrive counts hard braking, sharp starts and sharp turns, and compares them with what is normal on the roads you drove.
          </Text>
          <View style={s.fact}>
            <Text style={s.factNumber}>93%</Text>
            <Text style={s.factText}>smaller score gap between highways and city streets than a standard driving score.</Text>
          </View>
          <View style={s.actions}>
            <Button label="See how it works" onPress={onHow} />
            <TextLink label="See the results" onPress={onResults} large />
          </View>
        </View>
        <PhoneMock />
      </Animated.View>
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

function Roads({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.surfaceBand]}>
      <View style={s.content}>
        <Heading wide={wide} title="Normal braking depends on the road." rest="Standard scores ignore that. FairDrive builds it in." />
        <View style={[s.tiles, wide && s.row]}>
          <Tile wide={wide} title="Expects more braking downtown" text="Lights, crossings and traffic make frequent stops normal on city streets.">
            <Photo source={PHOTOS.city} ratio={4 / 3} label="Brake lights in city traffic at dusk, seen from the driver's seat" />
          </Tile>
          <Tile wide={wide} title="Expects steady speed on highways" text="A hard brake on an open highway stands out, so it counts for more.">
            <Photo source={PHOTOS.highway} ratio={4 / 3} label="A wide, nearly empty highway under a blue sky" />
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
        <Heading wide={wide} title="How FairDrive scores a drive." rest="Just a phone in a mount, no extra hardware." />
        <View style={[s.tiles, wide && s.row]}>
          <Tile wide={wide} white title="Records how the car moves" text="The phone logs braking, speeding up and turning 50 times a second, and its position once a second.">
            <Photo source={PHOTOS.mount} ratio={4 / 3} label="A phone in a dashboard mount, on a tree-lined street" />
          </Tile>
          <Tile wide={wide} white title="Looks up the conditions" text="Road type, speed limit, daylight and weather for every kilometre of the drive.">
            <View style={s.conditions}>
              {([['road-variant', 'Main road'], ['car-speed-limiter', '50 km/h limit'], ['weather-night', 'After dark'], ['weather-rainy', 'Light rain']] as [IconName, string][]).map(([icon, label]) => (
                <View key={label} style={s.condition}>
                  <MaterialCommunityIcons name={icon} size={20} color={C.green} />
                  <Text style={s.conditionText}>{label}</Text>
                </View>
              ))}
            </View>
          </Tile>
          <Tile wide={wide} white title="Compares each moment with normal" text="Every hard brake, sharp start and sharp turn is set against what is normal there.">
            <View style={s.moments}>
              {SAMPLE_MOMENTS.slice(0, 2).map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
            </View>
          </Tile>
        </View>
      </View>
    </View>
  );
}

function TwoScores({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.surfaceBand]}>
      <View style={s.content}>
        <Heading wide={wide} title="Two scores for every drive." rest="One for you, one for the conditions." />
        <View style={[s.tiles, wide && s.row]}>
          <ScoreTile wide={wide} title="Driving score" value={72} color={C.green}
            text="Your hard braking, sharp starts and sharp turns against normal. 50 is normal, 100 means none." />
          <ScoreTile wide={wide} title="Conditions score" value={64} color={C.amber}
            text="How demanding the drive was: roads, speed limits, light and weather. 100 is the easiest kind of drive." />
        </View>
      </View>
    </View>
  );
}

function Results({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.inkBand]}>
      <View style={s.content}>
        <Heading wide={wide} onInk title="Tested on 37 trips by 6 drivers." rest="On UAH-DriveSet, a public dataset." />
        <View style={[s.tiles, wide && s.row]}>
          <GapTile wide={wide} title="Standard score" gap="19-point gap" values={[70.1, 51.2]} color={C.red} />
          <GapTile wide={wide} title="FairDrive" gap="1-point gap" values={[59.0, 57.7]} color="#4ADE80" />
        </View>
        <View style={[s.stats, wide && s.row]}>
          <Stat value="93%" text="smaller gap between road types than the standard score" />
          <Stat value="22.6%" text="more accurate than a simple average, on drivers it had never seen" />
        </View>
        <Text style={[s.small, s.onInkMuted, s.note]}>Measured on drives in Spain. Drives in Ontario are next.</Text>
      </View>
    </View>
  );
}

function Privacy({ wide }: { wide: boolean }) {
  return (
    <View style={s.band}>
      <View style={s.content}>
        <Heading wide={wide} title="Privacy built into every trip." rest="A fair score needs drivers who trust it." />
        <View style={[s.points, wide && s.row]}>
          <Point wide={wide} title="Home and work stay private" text="The first and last 500 m of every trip are cut before anything is saved." />
          <Point wide={wide} title="No raw sensor data kept" text="Only the cleaned trip is stored, never the phone's raw readings." />
          <Point wide={wide} title="Your trips stay yours" text="Only you see them. Delete your account and every trip goes with it." />
        </View>
      </View>
    </View>
  );
}

function Close({ wide }: { wide: boolean }) {
  return (
    <View style={[s.band, s.greenBand]}>
      <View style={s.content}>
        <Text style={[s.h2, s.onGreen, !wide && s.h2Narrow]}>Your score arrives a moment after you park.</Text>
        <Text style={[s.lead, s.onGreenMuted]}>Drive at least 3 km with the FairDrive app open. Both scores and three plain reasons follow.</Text>
      </View>
    </View>
  );
}

function Footer({ goTo, onLogin }: { goTo: (anchor: string) => void; onLogin: () => void }) {
  return (
    <View style={s.footer}>
      <View style={[s.content, s.footerInner]}>
        <View style={s.footerRow}>
          <Wordmark />
          <View style={s.footerLinks}>
            <TextLink label="How it works" onPress={() => goTo('how')} />
            <TextLink label="Results" onPress={() => goTo('results')} />
            <TextLink label="Privacy" onPress={() => goTo('privacy')} />
            <TextLink label="Log in" onPress={onLogin} />
          </View>
        </View>
        <View style={s.rule} />
        <Text style={s.small}>A student research project, 2026. Photos generated with Gemini.</Text>
      </View>
    </View>
  );
}

// Pieces

const Wordmark = () => (
  <View style={s.wordmarkRow}>
    <View style={s.mark}><MaterialCommunityIcons name="road-variant" size={16} color={C.white} /></View>
    <Text style={s.wordmark}>FairDrive</Text>
  </View>
);

const Heading = ({ wide, title, rest, onInk }: { wide: boolean; title: string; rest: string; onInk?: boolean }) => (
  <Text style={[s.h2, !wide && s.h2Narrow, onInk && s.onInk]}>
    {title} <Text style={onInk ? s.onInkMuted : s.headingMuted}>{rest}</Text>
  </Text>
);

/** A photo that keeps its shape at any width. The browser otherwise sizes an image from the file, not the layout. */
function Photo({ source, ratio, label }: { source: ImageSourcePropType; ratio: number; label: string }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={s.photoBox} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <Image source={source} style={{ width, height: width / ratio, borderRadius: 16 }} resizeMode="cover" accessibilityLabel={label} />}
    </View>
  );
}

const Tile = (p: { wide: boolean; white?: boolean; title: string; text: string; children: ReactNode }) => (
  <View style={[s.tile, p.white && s.tileWhite, p.wide && s.flex]}>
    <Text style={s.tileTitle}>{p.title}</Text>
    <Text style={s.tileText}>{p.text}</Text>
    <View style={s.tileVisual}>{p.children}</View>
  </View>
);

const ScoreTile = (p: { wide: boolean; title: string; value: number; color: string; text: string }) => (
  <View style={[s.tile, s.tileWhite, p.wide && s.flex]}>
    <Text style={s.tileTitle}>{p.title}</Text>
    <Text style={[s.scoreValue, { color: p.color }]}>{p.value}</Text>
    <Text style={s.tileText}>{p.text}</Text>
  </View>
);

const GapTile = ({ wide, title, gap, values, color }: { wide: boolean; title: string; gap: string; values: [number, number]; color: string }) => (
  <View style={[s.darkTile, wide && s.flex]}>
    <View style={s.gapHead}>
      <Text style={[s.tileTitle, s.onInk]}>{title}</Text>
      <Text style={[s.gapLabel, { color }]}>{gap}</Text>
    </View>
    {(['Mostly highway', 'Other roads'] as const).map((label, i) => (
      <View key={label} style={s.bar}>
        <View style={s.barLabels}>
          <Text style={[s.small, s.onInkMuted]}>{label}</Text>
          <Text style={[s.small, s.onInk, s.barValue]}>{values[i].toFixed(0)}</Text>
        </View>
        <View style={s.barTrack}><View style={[s.barFill, { width: `${values[i]}%`, backgroundColor: color }]} /></View>
      </View>
    ))}
  </View>
);

const Stat = ({ value, text }: { value: string; text: string }) => (
  <View style={s.stat}>
    <Text style={s.statValue}>{value}</Text>
    <Text style={[s.small, s.onInkMuted, s.statText]}>{text}</Text>
  </View>
);

const Point = ({ wide, title, text }: { wide: boolean; title: string; text: string }) => (
  <View style={[s.point, wide && s.flex]}>
    <Text style={s.pointTitle}>{title}</Text>
    <Text style={s.tileText}>{text}</Text>
  </View>
);

function Button({ label, dark, small, onPress }: { label: string; dark?: boolean; small?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
      s.button, dark && s.buttonDark, small && s.buttonSmall, hovered && (dark ? s.buttonDarkHover : s.buttonHover), pressed && s.buttonPressed,
    ]}>
      <Text style={[s.buttonText, small && s.buttonTextSmall]}>{label}</Text>
    </Pressable>
  );
}

function TextLink({ label, large, onPress }: { label: string; large?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => <Text style={[s.link, large && s.linkLarge, hovered && s.linkHover]}>{label}</Text>}
    </Pressable>
  );
}

const f = (family: string, style: TextStyle): TextStyle => ({ fontFamily: family, color: C.ink, ...style });

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 24 },
  band: { backgroundColor: C.paper, paddingVertical: 104 },
  surfaceBand: { backgroundColor: C.surface },
  inkBand: { backgroundColor: C.ink },
  greenBand: { backgroundColor: C.green, paddingVertical: 88 },
  onInk: { color: C.onInk },
  onInkMuted: { color: C.onInkMuted },
  onGreen: { color: C.white },
  onGreenMuted: { color: '#D7EBDD', marginTop: 16 },

  nav: { height: 68, justifyContent: 'center', backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navLinks: { flexDirection: 'row', gap: 36 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  wordmark: f(HEAD, { fontSize: 22, letterSpacing: -0.4 }),

  heroBand: { paddingTop: 72, paddingBottom: 96 },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 72 },
  heroNarrow: { gap: 56, alignItems: 'center' },
  heroText: { flex: 1 },
  h1: f(HEAD, { fontSize: 68, lineHeight: 72, letterSpacing: -2 }),
  h1Narrow: { fontSize: 42, lineHeight: 46, letterSpacing: -1.2 },
  lead: f(BODY, { fontSize: 20, lineHeight: 30, color: C.muted, marginTop: 24, maxWidth: 600 }),
  fact: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: C.line, maxWidth: 560 },
  factNumber: f(HEAD, { fontSize: 48, lineHeight: 52, color: C.green, letterSpacing: -1 }),
  factText: f(BODY_MEDIUM, { flex: 1, fontSize: 16, lineHeight: 23 }),
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 28, marginTop: 36 },

  phone: { width: 320, height: 640, borderRadius: 50, backgroundColor: C.ink, padding: 11 },
  phoneScreen: { flex: 1, borderRadius: 40, overflow: 'hidden', backgroundColor: T.background[0], paddingHorizontal: 14, gap: 10 },
  statusBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  statusText: { color: T.text, fontSize: 14, fontWeight: '700' },
  island: { width: 92, height: 26, borderRadius: 13, backgroundColor: C.ink },
  statusIcons: { flexDirection: 'row', gap: 4 },
  phoneTitle: { color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, paddingHorizontal: 4 },
  phoneCard: { alignItems: 'center', paddingVertical: 14, gap: 4 },
  phoneHeadline: { color: T.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  phoneMoments: { paddingVertical: 4, paddingHorizontal: 14 },

  h2: f(HEAD, { fontSize: 48, lineHeight: 54, letterSpacing: -1.2, maxWidth: 900, marginBottom: 48 }),
  h2Narrow: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  headingMuted: { color: C.muted },

  tiles: { gap: 20 },
  tile: { backgroundColor: C.paper, borderRadius: 24, padding: 28, gap: 8 },
  tileWhite: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  tileTitle: f(HEAD_SEMI, { fontSize: 24, lineHeight: 29, letterSpacing: -0.3 }),
  tileText: f(BODY, { fontSize: 16, lineHeight: 24, color: C.muted }),
  tileVisual: { marginTop: 20 },
  photoBox: { width: '100%' },

  conditions: { gap: 10 },
  condition: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  conditionText: f(BODY_MEDIUM, { fontSize: 16 }),
  moments: { backgroundColor: C.paper, borderRadius: 14, paddingHorizontal: 14 },

  scoreValue: f(HEAD, { fontSize: 104, lineHeight: 112, letterSpacing: -3, marginVertical: 4 }),

  darkTile: { backgroundColor: '#262219', borderRadius: 24, padding: 28, gap: 20 },
  gapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gapLabel: f(BODY_BOLD, { fontSize: 16 }),
  bar: { gap: 8 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barValue: { fontFamily: BODY_BOLD },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#3A352B' },
  barFill: { height: 8, borderRadius: 4 },
  stats: { gap: 40, marginTop: 56 },
  stat: { flex: 1, gap: 8 },
  statValue: f(HEAD, { fontSize: 72, lineHeight: 76, letterSpacing: -2, color: C.onInk }),
  statText: { maxWidth: 320 },
  note: { marginTop: 40 },
  small: f(BODY, { fontSize: 14, lineHeight: 20 }),

  points: { gap: 36 },
  point: { gap: 8, borderTopWidth: 2, borderTopColor: C.ink, paddingTop: 20 },
  pointTitle: f(HEAD_SEMI, { fontSize: 22, lineHeight: 27 }),

  footer: { backgroundColor: C.paper, paddingVertical: 40, borderTopWidth: 1, borderTopColor: C.line },
  footerInner: { gap: 20 },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 28 },
  rule: { height: 1, backgroundColor: C.line },

  button: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 15 },
  buttonDark: { backgroundColor: C.ink },
  buttonSmall: { paddingHorizontal: 20, paddingVertical: 10 },
  buttonHover: { backgroundColor: C.greenHover, transform: [{ translateY: -1 }] },
  buttonDarkHover: { backgroundColor: '#2E2A22', transform: [{ translateY: -1 }] },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: f(BODY_BOLD, { color: C.white, fontSize: 17 }),
  buttonTextSmall: { fontSize: 15 },
  link: f(BODY_MEDIUM, { fontSize: 15 }),
  linkLarge: { fontSize: 17, fontFamily: BODY_BOLD, color: C.green },
  linkHover: { textDecorationLine: 'underline' },
});
