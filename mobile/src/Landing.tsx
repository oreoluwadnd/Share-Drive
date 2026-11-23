// The web front page. Layout after Mobbin references: Superpower and Jeton (hero with a phone),
// Hims (statement), Norma (how it works), Legora and SpaceXAI (big numbers), Amperos (dark card).
// Every number comes from docs/fairness-audit.md (UAH-DriveSet, 6 drivers, 37 scored trips).
// The two photos in assets/landing were generated with Gemini.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentRef, createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ImageBackground, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Moment } from './fairdrive';
import { DrivingRoad, ScoreRing } from './motion';
import { MomentRow } from './score';
import { T } from './theme';
import { IconName, ui } from './ui';

const WIDE = 960;
const GREEN_TEXT = '#15803D'; // the brand green, dark enough to read on white
const SAMPLE_MOMENTS: Moment[] = [
  { kind: 'hard_brake', label: 'Hard braking', count: 3, normal: 1.2 },
  { kind: 'hard_accel', label: 'Sharp speeding up', count: 1, normal: 1.6 },
  { kind: 'hard_corner', label: 'Sharp turns', count: 2, normal: 2.4 },
];

// Sections reveal themselves as they scroll into view, and register where they sit for the nav links.
const Page = createContext<{ bottom: number; register: (anchor: string, y: number) => void }>({ bottom: 0, register: () => {} });

export default function Landing({ onAdmin }: { onAdmin: () => void }) {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const anchors = useRef<Record<string, number>>({});
  const [scrollY, setScrollY] = useState(0);
  const goTo = (anchor: string) => scroll.current?.scrollTo({ y: Math.max(0, anchors.current[anchor] - 96), animated: true });

  return (
    <View style={s.root}>
      <ScrollView ref={scroll} onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}>
        <Page.Provider value={{ bottom: scrollY + height, register: (anchor, y) => { anchors.current[anchor] = y; } }}>
          <Hero wide={wide} onHow={() => goTo('how')} onAdmin={onAdmin} />
          <Statement wide={wide} />
          <HowItWorks wide={wide} />
          <TwoScores wide={wide} />
          <Proof wide={wide} />
          <Privacy wide={wide} />
          <FinalCall onHow={() => goTo('how')} onAdmin={onAdmin} />
          <Footer onAdmin={onAdmin} />
        </Page.Provider>
      </ScrollView>
      <Nav wide={wide} goTo={goTo} onAdmin={onAdmin} raised={scrollY > 24} />
    </View>
  );
}

function Nav({ wide, goTo, onAdmin, raised }: { wide: boolean; goTo: (a: string) => void; onAdmin: () => void; raised: boolean }) {
  return (
    <View style={s.navWrap} pointerEvents="box-none">
      <View style={[s.nav, raised && s.navRaised]}>
        <Logo />
        {wide && (
          <View style={s.navLinks}>
            {[['How it works', 'how'], ['Two scores', 'scores'], ['Results', 'proof'], ['Privacy', 'privacy']].map(([label, anchor]) => (
              <Pressable key={anchor} onPress={() => goTo(anchor)} style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.navLinkBox, hovered && s.navLinkHover]}>
                <Text style={s.navLink}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Button label="Admin login" icon="lock-outline" small onPress={onAdmin} />
      </View>
    </View>
  );
}

function Hero({ wide, onHow, onAdmin }: { wide: boolean; onHow: () => void; onAdmin: () => void }) {
  return (
    <View style={s.hero}>
      <View style={[s.glow, s.glowGreen]} />
      <View style={[s.glow, s.glowTeal]} />
      <View style={[s.frame, wide ? s.heroWide : s.heroNarrow]}>
        <SlideUp delay={0} style={wide ? s.heroText : undefined}>
          <View style={s.eyebrow}>
            <View style={s.eyebrowDot} />
            <Text style={s.eyebrowText}>Driving scores that are fair to everyone</Text>
          </View>
          <Text style={[s.h1, !wide && s.h1Narrow]}>
            Scored on your driving.{'\n'}<Text style={{ color: GREEN_TEXT }}>Not on your roads.</Text>
          </Text>
          <Text style={s.heroLead}>
            Most driving apps count hard brakes and sharp turns, so a careful driver on busy streets can score worse than a careless
            one on an empty highway. FairDrive compares every trip with what's normal for its roads, light and weather.
          </Text>
          <View style={s.buttonRow}>
            <Button label="See how it works" icon="arrow-down" onPress={onHow} />
            <Button label="Admin login" icon="lock-outline" secondary onPress={onAdmin} />
          </View>
          <View style={s.checks}>
            <Check text="Two scores, three plain reasons" />
            <Check text="Start and end of every trip hidden" />
          </View>
        </SlideUp>
        <SlideUp delay={200} style={s.phoneArea}>
          <PhoneMock />
          {wide && (
            <>
              <FloatCard style={s.floatTopLeft} icon="weather-partly-cloudy" label="Conditions" value="Fairly easy" />
              <FloatCard style={s.floatBottomRight} icon="history" label="Old score" value="55 · ignores roads" />
            </>
          )}
        </SlideUp>
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
        <Text style={s.phoneBrand}>FairDrive</Text>
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

function Statement({ wide }: { wide: boolean }) {
  const hi = { color: GREEN_TEXT };
  return (
    <Reveal style={[s.frame, s.statement]}>
      <Text style={[s.statementText, !wide && s.statementNarrow]}>
        A trip through town needs <Text style={hi}>more braking</Text> than a drive on the 401. Old scores call that{' '}
        <Text style={s.strike}>bad driving</Text>. FairDrive calls it <Text style={hi}>normal</Text>.
      </Text>
    </Reveal>
  );
}

function HowItWorks({ wide }: { wide: boolean }) {
  return (
    <Reveal anchor="how" style={[s.frame, s.section]}>
      <SectionHead kicker="How it works" title="From your drive to a fair score" lead="No extra hardware. Just a phone in a mount." />
      <View style={[s.cards, wide && s.cardsWide]}>
        <StepCard number={1} wide={wide} title="Drive with your phone" text="Mount your phone, tap Start and drive. It records how the car moves, and where.">
          <Image source={require('../assets/landing/phone-mount.jpg')} style={s.stepPhoto} resizeMode="cover" accessibilityLabel="A phone in a dashboard mount, on a tree-lined street" />
        </StepCard>
        <StepCard number={2} wide={wide} title="We read the conditions" text="FairDrive looks up the road types, speed limits, daylight and weather along your route.">
          <View style={s.conditionGrid}>
            <Condition icon="road-variant" label="Main road" />
            <Condition icon="car-speed-limiter" label="50 km/h" />
            <Condition icon="weather-night" label="After dark" />
            <Condition icon="weather-rainy" label="Light rain" />
          </View>
        </StepCard>
        <StepCard number={3} wide={wide} title="You get a fair score" text="Each harsh moment is compared with what's normal on those roads, with a reason you can act on.">
          <View style={s.stepMoments}>
            {SAMPLE_MOMENTS.slice(0, 2).map((moment, i) => <MomentRow key={moment.kind} moment={moment} first={i === 0} />)}
          </View>
        </StepCard>
      </View>
    </Reveal>
  );
}

function TwoScores({ wide }: { wide: boolean }) {
  return (
    <Reveal anchor="scores" style={[s.frame, s.section]}>
      <SectionHead kicker="Two scores" title="One is yours. One is the road's." lead="Busy streets, darkness and rain aren't your fault, so they get their own score." />
      <View style={[s.cards, wide && s.cardsWide]}>
        <ScoreExplainer
          icon="steering" color={T.ring.good} title="Driving score" tag="Yours to control" value={72}
          text="Your hard braking, sharp speeding up and sharp turns, compared with what's normal for the trip's conditions. 50 is normal, 100 is none at all."
        />
        <ScoreExplainer
          icon="weather-partly-cloudy" color={T.ring.fair} title="Conditions score" tag="Not your fault" value={64}
          text="How demanding the trip was: road types, speed limits, daylight and weather. 100 is the easiest kind of drive."
        />
      </View>
    </Reveal>
  );
}

function Proof({ wide }: { wide: boolean }) {
  const { bottom } = useContext(Page);
  const [top, setTop] = useState(Infinity);
  const visible = bottom > top + 160;
  return (
    <Reveal anchor="proof" style={[s.frame, s.section]}>
      <View onLayout={(e) => setTop(e.nativeEvent.layout.y)} />
      <SectionHead kicker="Results" title="The old score swings with the road. FairDrive doesn't." lead="Average scores for the same drivers on different kinds of road." />
      <View style={[s.cards, wide && s.cardsWide]}>
        <GapCard title="Old score" note="Ignores conditions" values={[51.2, 70.1]} gap="19-point gap" bad visible={visible} />
        <GapCard title="FairDrive" note="Compares with what's normal" values={[57.7, 59.0]} gap="1-point gap" visible={visible} />
      </View>
      <View style={[s.stats, wide && s.statsWide]}>
        <BigStat value={93} suffix="%" text="smaller score gap between road types than the old score" visible={visible} />
        <BigStat value={22.6} decimals={1} suffix="%" text="more accurate than a simple average, on drivers it had never seen" visible={visible} />
        <BigStat value={500} suffix=" m" text="hidden at the start and end of every trip" visible={visible} />
      </View>
      <Text style={[ui.muted, ui.centerText]}>Measured on UAH-DriveSet: 6 drivers, 37 trips, Spain. Ontario drives are next.</Text>
    </Reveal>
  );
}

function Privacy({ wide }: { wide: boolean }) {
  return (
    <Reveal anchor="privacy" style={[s.frame, s.section]}>
      <LinearGradient colors={['#12151B', '#1D2430']} style={[s.dark, wide && s.darkWide]}>
        <View style={wide ? s.darkText : undefined}>
          <Text style={s.darkKicker}>Privacy</Text>
          <Text style={s.darkTitle}>Built to respect the people being scored.</Text>
          <Text style={s.darkLead}>A score is only fair if drivers can trust what happens to their data.</Text>
        </View>
        <View style={[s.darkList, wide && s.darkListWide]}>
          <DarkPoint icon="home-lock" title="Home and work stay private" text="The first and last 500 m of every trip are cut before anything is saved." />
          <DarkPoint icon="database-off-outline" title="No raw sensor data kept" text="Only the cleaned trip is stored, never the phone's raw readings." />
          <DarkPoint icon="shield-account-outline" title="Admins sign in" text="Each admin has their own account. Passwords are never stored as plain text." />
        </View>
      </LinearGradient>
    </Reveal>
  );
}

function FinalCall({ onHow, onAdmin }: { onHow: () => void; onAdmin: () => void }) {
  return (
    <Reveal style={[s.frame, s.final]}>
      <ImageBackground source={require('../assets/landing/highway-dusk.jpg')} style={s.finalCard} imageStyle={s.finalImage} accessibilityLabel="An empty highway at dusk">
        <LinearGradient colors={['rgba(9,12,20,0.62)', 'rgba(9,12,20,0.28)', 'rgba(9,12,20,0.7)']} style={StyleSheet.absoluteFill} />
        <View style={s.finalText}>
          <Text style={[s.h2, s.finalTitle]}>Drive. Stop. See your fair score.</Text>
          <Text style={s.finalLead}>Your score arrives on your phone a moment after you park, with three plain reasons behind it.</Text>
          <View style={[s.buttonRow, s.centerRow]}>
            <Button label="See how it works" icon="arrow-up" light onPress={onHow} />
            <Button label="Admin login" icon="lock-outline" glass onPress={onAdmin} />
          </View>
        </View>
        <View style={s.finalRoad}><DrivingRoad kmh={80} /></View>
      </ImageBackground>
    </Reveal>
  );
}

function Footer({ onAdmin }: { onAdmin: () => void }) {
  return (
    <View style={[s.frame, s.footer]}>
      <Logo />
      <Text style={ui.muted}>A student project, 2026. Scores tested on UAH-DriveSet; Ontario drives in progress.</Text>
      <Pressable onPress={onAdmin}><Text style={s.footerLink}>Admin login</Text></Pressable>
    </View>
  );
}

// Pieces

const Logo = () => (
  <View style={s.logo}>
    <LinearGradient colors={T.ring.good} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoMark}>
      <MaterialCommunityIcons name="car-side" size={16} color="#FFFFFF" />
    </LinearGradient>
    <Text style={s.logoText}>FairDrive</Text>
  </View>
);

function Button(p: { label: string; icon: IconName; onPress: () => void; secondary?: boolean; small?: boolean; light?: boolean; glass?: boolean }) {
  const darkText = p.secondary || p.light;
  return (
    <Pressable onPress={p.onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
      s.button, p.secondary && s.buttonSecondary, p.light && s.buttonLight, p.glass && s.buttonGlass, p.small && s.buttonSmall,
      hovered && s.buttonHover, pressed && ui.pressed,
    ]}>
      <Text style={[s.buttonText, darkText && s.buttonTextSecondary, p.small && s.buttonTextSmall]}>{p.label}</Text>
      <MaterialCommunityIcons name={p.icon} size={p.small ? 15 : 18} color={darkText ? T.text : '#FFFFFF'} />
    </Pressable>
  );
}

const Check = ({ text }: { text: string }) => (
  <View style={s.check}>
    <MaterialCommunityIcons name="check-circle" size={18} color={T.ring.good[0]} />
    <Text style={s.checkText}>{text}</Text>
  </View>
);

const FloatCard = ({ style, icon, label, value }: { style: object; icon: IconName; label: string; value: string }) => (
  <View style={[s.float, style]}>
    <View style={s.floatIcon}><MaterialCommunityIcons name={icon} size={18} color={T.text} /></View>
    <View>
      <Text style={ui.label}>{label}</Text>
      <Text style={s.floatValue}>{value}</Text>
    </View>
  </View>
);

const SectionHead = ({ kicker, title, lead }: { kicker: string; title: string; lead: string }) => (
  <View style={s.sectionHead}>
    <Text style={s.kicker}>{kicker}</Text>
    <Text style={[s.h2, ui.centerText]}>{title}</Text>
    <Text style={[ui.lead, ui.centerText]}>{lead}</Text>
  </View>
);

const StepCard = ({ number, title, text, wide, children }: { number: number; title: string; text: string; wide: boolean; children: ReactNode }) => (
  <View style={[ui.card, s.step, wide && s.stepWide]}>
    <View style={s.stepNumber}><Text style={s.stepNumberText}>{number}</Text></View>
    <Text style={s.cardTitle}>{title}</Text>
    <Text style={ui.muted}>{text}</Text>
    <View style={s.stepVisual}>{children}</View>
  </View>
);

const Condition = ({ icon, label }: { icon: IconName; label: string }) => (
  <View style={s.condition}>
    <MaterialCommunityIcons name={icon} size={20} color={T.text} />
    <Text style={s.conditionText}>{label}</Text>
  </View>
);

function ScoreExplainer(p: { icon: IconName; color: readonly [string, string]; title: string; tag: string; value: number; text: string }) {
  return (
    <View style={[ui.card, s.explainer]}>
      <LinearGradient colors={[`${p.color[0]}1A`, '#FFFFFF00']} style={StyleSheet.absoluteFill} />
      <View style={s.explainerHead}>
        <View style={[s.explainerIcon, { backgroundColor: `${p.color[0]}26` }]}>
          <MaterialCommunityIcons name={p.icon} size={22} color={p.color[0]} />
        </View>
        <View style={[s.tag, { backgroundColor: `${p.color[0]}1F` }]}>
          <Text style={[s.tagText, { color: p.color[1] }]}>{p.tag}</Text>
        </View>
      </View>
      <Text style={s.explainerValue}>{p.value}</Text>
      <Text style={s.cardTitle}>{p.title}</Text>
      <Text style={ui.muted}>{p.text}</Text>
    </View>
  );
}

function GapCard({ title, note, values, gap, bad, visible }: { title: string; note: string; values: [number, number]; gap: string; bad?: boolean; visible: boolean }) {
  const colors = bad ? T.ring.poor : T.ring.good;
  return (
    <View style={[ui.card, s.gapCard]}>
      <View style={s.gapHead}>
        <View>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={ui.muted}>{note}</Text>
        </View>
        <View style={[s.tag, { backgroundColor: `${colors[0]}1F` }]}>
          <Text style={[s.tagText, { color: colors[1] }]}>{gap}</Text>
        </View>
      </View>
      {(['Mostly highway', 'Other roads'] as const).map((label, i) => (
        <View key={label} style={s.barRow}>
          <View style={s.barLabelRow}>
            <Text style={s.barLabel}>{label}</Text>
            <Text style={s.barValue}>{values[i].toFixed(0)}</Text>
          </View>
          <View style={s.barTrack}>
            <GrowBar to={values[i]} colors={colors} visible={visible} />
          </View>
        </View>
      ))}
    </View>
  );
}

function GrowBar({ to, colors, visible }: { to: number; colors: readonly [string, string]; visible: boolean }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) Animated.timing(grow, { toValue: to, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [visible]);
  return (
    <Animated.View style={[s.barFill, { width: grow.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function BigStat({ value, decimals = 0, suffix, text, visible }: { value: number; decimals?: number; suffix: string; text: string; visible: boolean }) {
  const count = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = count.addListener(({ value: v }) => setShown(v));
    if (visible) Animated.timing(count, { toValue: value, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => count.removeListener(id);
  }, [visible]);
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{shown.toFixed(decimals)}{suffix}</Text>
      <Text style={[ui.muted, ui.centerText, s.statText]}>{text}</Text>
    </View>
  );
}

const DarkPoint = ({ icon, title, text }: { icon: IconName; title: string; text: string }) => (
  <View style={s.darkPoint}>
    <View style={s.darkIcon}><MaterialCommunityIcons name={icon} size={20} color={T.ring.good[0]} /></View>
    <View style={s.flex}>
      <Text style={s.darkPointTitle}>{title}</Text>
      <Text style={s.darkPointText}>{text}</Text>
    </View>
  </View>
);

function SlideUp({ delay, style, children }: { delay: number; style?: object; children: ReactNode }) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, []);
  const rise = appear.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  return <Animated.View style={[style, { opacity: appear, transform: [{ translateY: rise }] }]}>{children}</Animated.View>;
}

/** Fades a section up the first time it scrolls into view, and registers its position under `anchor`. */
function Reveal({ anchor, style, children }: { anchor?: string; style?: object | object[]; children: ReactNode }) {
  const { bottom, register } = useContext(Page);
  const [top, setTop] = useState(Infinity);
  const appear = useRef(new Animated.Value(0)).current;
  const shown = bottom > top + 80;
  useEffect(() => {
    if (shown) Animated.timing(appear, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [shown]);
  const onLayout = (e: LayoutChangeEvent) => {
    setTop(e.nativeEvent.layout.y);
    if (anchor) register(anchor, e.nativeEvent.layout.y);
  };
  const rise = appear.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return <Animated.View onLayout={onLayout} style={[style, { opacity: appear, transform: [{ translateY: rise }] }]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.background[0] },
  flex: { flex: 1 },
  frame: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24 },

  navWrap: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  nav: {
    width: '100%', maxWidth: 1100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 999, paddingLeft: 20, paddingRight: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
  } as object,
  navRaised: { backgroundColor: 'rgba(255,255,255,0.9)', ...T.cardShadow },
  navLinks: { flexDirection: 'row', gap: 28 },
  navLink: { color: T.text, fontSize: 15, fontWeight: '600' },
  navLinkBox: { opacity: 0.7 },
  navLinkHover: { opacity: 1 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  hero: { paddingTop: 140, paddingBottom: 80, overflow: 'hidden' },
  glow: { position: 'absolute', width: 620, height: 620, borderRadius: 310, filter: 'blur(90px)' } as object,
  glowGreen: { top: -160, right: -80, backgroundColor: 'rgba(34,197,94,0.22)' },
  glowTeal: { top: 220, left: -220, backgroundColor: 'rgba(16,185,168,0.16)' },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  heroNarrow: { gap: 48 },
  heroText: { flex: 1 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: T.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, ...T.cardShadow },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.ring.good[0] },
  eyebrowText: { color: T.text, fontSize: 14, fontWeight: '600' },
  h1: { color: T.text, fontSize: 68, lineHeight: 72, fontWeight: '800', letterSpacing: -2.6, marginTop: 24 },
  h1Narrow: { fontSize: 44, lineHeight: 48, letterSpacing: -1.6 },
  heroLead: { color: T.muted, fontSize: 19, lineHeight: 29, marginTop: 22, maxWidth: 560 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 32 },
  centerRow: { justifyContent: 'center' },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 28 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { color: T.text, fontSize: 15, fontWeight: '600' },

  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.text, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 16 },
  buttonSecondary: { backgroundColor: T.card, ...T.cardShadow },
  buttonLight: { backgroundColor: '#FFFFFF' },
  buttonGlass: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  buttonSmall: { paddingHorizontal: 16, paddingVertical: 10 },
  buttonHover: { transform: [{ translateY: -1 }], opacity: 0.92 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonTextSecondary: { color: T.text },
  buttonTextSmall: { fontSize: 14 },

  phoneArea: { alignItems: 'center', justifyContent: 'center' },
  phone: { width: 320, height: 660, borderRadius: 52, backgroundColor: '#0F1115', padding: 10, shadowColor: '#0F1115', shadowOpacity: 0.28, shadowRadius: 50, shadowOffset: { width: 0, height: 30 } },
  phoneScreen: { flex: 1, borderRadius: 43, overflow: 'hidden', backgroundColor: T.background[0], paddingHorizontal: 14, gap: 10 },
  statusBar: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  statusText: { color: T.text, fontSize: 14, fontWeight: '700' },
  island: { width: 92, height: 26, borderRadius: 13, backgroundColor: '#0F1115' },
  statusIcons: { flexDirection: 'row', gap: 4 },
  phoneBrand: { color: T.text, fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
  phoneTitle: { color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, paddingHorizontal: 4, marginTop: -6 },
  phoneCard: { alignItems: 'center', overflow: 'hidden', paddingVertical: 14, gap: 4 },
  phoneHeadline: { color: T.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  phoneMoments: { paddingVertical: 4, paddingHorizontal: 14 },
  float: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, ...T.cardShadow, shadowOpacity: 0.12, shadowRadius: 30 },
  floatTopLeft: { top: 110, left: -10 },
  floatBottomRight: { bottom: -22, right: -36 },
  floatIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.track, alignItems: 'center', justifyContent: 'center' },
  floatValue: { color: T.text, fontSize: 15, fontWeight: '800' },

  statement: { paddingVertical: 80, alignItems: 'center' },
  statementText: { color: T.text, fontSize: 46, lineHeight: 56, fontWeight: '800', letterSpacing: -1.6, textAlign: 'center', maxWidth: 940 },
  statementNarrow: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  strike: { color: T.faint, textDecorationLine: 'line-through' },

  section: { paddingVertical: 64, gap: 36 },
  sectionHead: { alignItems: 'center', gap: 12, maxWidth: 720, alignSelf: 'center' },
  kicker: { color: GREEN_TEXT, fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4 },
  h2: { color: T.text, fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.4 },
  cards: { gap: 18 },
  cardsWide: { flexDirection: 'row' },
  cardTitle: { color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },

  step: { padding: 24, gap: 10 },
  stepWide: { flex: 1 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: T.track, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: T.text, fontSize: 14, fontWeight: '800' },
  stepVisual: { marginTop: 10, minHeight: 130, justifyContent: 'center' },
  stepPhoto: { width: '100%', height: 240, borderRadius: 20 },
  stepMoments: { backgroundColor: T.background[0], borderRadius: 20, paddingHorizontal: 14 },
  conditionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  condition: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.background[0], borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, flexGrow: 1, flexBasis: 130 },
  conditionText: { color: T.text, fontSize: 14, fontWeight: '700' },

  explainer: { flex: 1, padding: 28, gap: 8, overflow: 'hidden' },
  explainerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  explainerIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  explainerValue: { color: T.text, fontSize: 84, fontWeight: '800', letterSpacing: -4, fontVariant: ['tabular-nums'], marginTop: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 13, fontWeight: '800' },

  gapCard: { flex: 1, padding: 26, gap: 18 },
  gapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  barRow: { gap: 8 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: T.text, fontSize: 15, fontWeight: '600' },
  barValue: { color: T.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  barTrack: { height: 14, borderRadius: 7, backgroundColor: T.track, overflow: 'hidden' },
  barFill: { height: 14, borderRadius: 7, overflow: 'hidden' },

  stats: { gap: 28, marginTop: 8 },
  statsWide: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { color: T.text, fontSize: 76, fontWeight: '800', letterSpacing: -3.5, fontVariant: ['tabular-nums'] },
  statText: { maxWidth: 260 },

  dark: { borderRadius: 36, padding: 36, gap: 32 },
  darkWide: { flexDirection: 'row', padding: 56, gap: 56 },
  darkText: { flex: 1 },
  darkKicker: { color: T.ring.good[0], fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.4 },
  darkTitle: { color: '#FFFFFF', fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2, marginTop: 12 },
  darkLead: { color: 'rgba(255,255,255,0.68)', fontSize: 17, lineHeight: 26, marginTop: 14 },
  darkList: { gap: 14 },
  darkListWide: { flex: 1.1 },
  darkPoint: { flexDirection: 'row', gap: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  darkIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(34,197,94,0.14)', alignItems: 'center', justifyContent: 'center' },
  darkPointTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  darkPointText: { color: 'rgba(255,255,255,0.68)', fontSize: 15, lineHeight: 22, marginTop: 3 },

  final: { paddingTop: 72, paddingBottom: 56 },
  finalCard: { borderRadius: 36, overflow: 'hidden', minHeight: 540, justifyContent: 'space-between', paddingTop: 72, paddingHorizontal: 24 },
  finalImage: { borderRadius: 36 },
  finalText: { alignItems: 'center', gap: 16 },
  finalTitle: { color: '#FFFFFF', textAlign: 'center' },
  finalLead: { color: 'rgba(255,255,255,0.85)', fontSize: 18, lineHeight: 27, textAlign: 'center', maxWidth: 560 },
  finalRoad: { width: '100%', maxWidth: 620, alignSelf: 'center', marginTop: 48, marginBottom: -28 },

  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 32, borderTopWidth: 1, borderTopColor: T.track },
  footerLink: { color: T.text, fontSize: 15, fontWeight: '700' },
});
