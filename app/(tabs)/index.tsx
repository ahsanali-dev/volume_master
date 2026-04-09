import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  Maximize2,
  Minus,
  Palette,
  Plus,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  Modal,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const VolumeModule = NativeModules.VolumeModule;
const STORAGE_KEY = "@volume_master_config";
const { width: SCREEN_W } = Dimensions.get("window");

const COLORS = [
  { label: "Indigo", hex: "#6366F1" },
  { label: "Blue", hex: "#3B82F6" },
  { label: "Teal", hex: "#14B8A6" },
  { label: "Green", hex: "#10B981" },
  { label: "Yellow", hex: "#F59E0B" },
  { label: "Orange", hex: "#F97316" },
  { label: "Red", hex: "#EF4444" },
  { label: "Pink", hex: "#EC4899" },
  { label: "Purple", hex: "#A855F7" },
  { label: "Slate", hex: "#475569" },
];

const DEFAULT_CONFIG = {
  active: false,
  color: "#6366F1",
  opacity: 0.9,
  size: 60,
  position: "left",
  volumeType: "music",
};

// --- Components ---

function SplashScreen({ onDone }: { onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const ring1 = useSharedValue(0.6);
  const ring2 = useSharedValue(0.6);
  const ring3 = useSharedValue(0.6);
  const textOp = useSharedValue(0);
  const containerOp = useSharedValue(1);

  useEffect(() => {
    // Logo pop-in
    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    opacity.value = withTiming(1, { duration: 400 });

    // Ripple loops
    setTimeout(() => {
      ring1.value = withRepeat(withTiming(1.5, { duration: 1800 }), -1, false);
    }, 0);
    setTimeout(() => {
      ring2.value = withRepeat(withTiming(1.6, { duration: 1800 }), -1, false);
    }, 600);
    setTimeout(() => {
      ring3.value = withRepeat(withTiming(1.7, { duration: 1800 }), -1, false);
    }, 1200);

    // Text fade-in
    textOp.value = withDelay(300, withTiming(1, { duration: 600 }));

    // Cleanup timer
    const timer = setTimeout(() => {
      containerOp.value = withTiming(0, { duration: 500 });
      setTimeout(onDone, 550);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const textStyle = useAnimatedStyle(() => {
    return {
      opacity: textOp.value,
      transform: [{ translateY: interpolate(textOp.value, [0, 1], [20, 0]) }],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOp.value,
    };
  });

  const generateRingStyle = (sv: any) => {
    return useAnimatedStyle(() => {
      return {
        transform: [{ scale: sv.value }],
        opacity: interpolate(sv.value, [0.6, 1.7], [0.5, 0]),
      };
    });
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.splash, containerStyle]}
    >
      <LinearGradient
        colors={["#0F172A", "#1E293B"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ripple Rings */}
      <Animated.View
        style={[
          styles.ring,
          { width: 120, height: 120, borderRadius: 60, borderColor: "#3B82F6" },
          generateRingStyle(ring1),
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { width: 120, height: 120, borderRadius: 60, borderColor: "#6366F1" },
          generateRingStyle(ring2),
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { width: 120, height: 120, borderRadius: 60, borderColor: "#A855F7" },
          generateRingStyle(ring3),
        ]}
      />

      <Animated.View style={[styles.logoCircle, logoStyle]}>
        <LinearGradient
          colors={["#6366F1", "#3B82F6"]}
          style={styles.logoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Volume2 color="white" size={44} />
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[{ alignItems: "center", marginTop: 32 }, textStyle]}
      >
        <Text style={styles.splashTitle}>Volume Master</Text>
        <Text style={styles.splashSub}>Control your volume, your way</Text>
      </Animated.View>
    </Animated.View>
  );
}

function SettingItem({
  icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: any;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLabelGroup}>
        <View style={styles.settingIconWrap}>{icon}</View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

function CustomSlider({
  value,
  min,
  max,
  onChange,
  color,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const range = max - min;
  const percent = ((value - min) / range) * 100;

  return (
    <View style={styles.sliderContainer}>
      <TouchableOpacity
        style={styles.sliderBtn}
        onPress={() => onChange(Math.max(min, value - (max - min) / 10))}
      >
        <Minus size={14} color="#94A3B8" />
      </TouchableOpacity>

      <View style={styles.sliderTrack}>
        <View
          style={[
            styles.sliderFill,
            { width: `${percent}%`, backgroundColor: color },
          ]}
        />
      </View>

      <TouchableOpacity
        style={styles.sliderBtn}
        onPress={() => onChange(Math.min(max, value + (max - min) / 10))}
      >
        <Plus size={14} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
}

// --- Main Screen ---

export default function VolumeMaster() {
  const [showSplash, setShowSplash] = useState(true);
  const [active, setActive] = useState(DEFAULT_CONFIG.active);
  const [color, setColor] = useState(DEFAULT_CONFIG.color);
  const [opacity, setOpacity] = useState(DEFAULT_CONFIG.opacity);
  const [size, setSize] = useState(DEFAULT_CONFIG.size);
  const [hasPermission, setHasPermission] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const previewPulse = useSharedValue(1);
  const appState = useRef(AppState.currentState);

  // Load config
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const config = JSON.parse(saved);
          setColor(config.color || DEFAULT_CONFIG.color);
          setOpacity(config.opacity || DEFAULT_CONFIG.opacity);
          setSize(config.size || DEFAULT_CONFIG.size);
        }
      } catch (e) {}
    })();
  }, []);

  // Save config
  useEffect(() => {
    const config = { color, opacity, size };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config)).catch(() => {});

    // Update live service if active
    if (active && VolumeModule) {
      VolumeModule.updateFloatingButton(color, opacity, size, "left", "music");
    }
  }, [color, opacity, size, active]);

  // Sync permission and service state
  const syncState = useCallback(async () => {
    if (!VolumeModule) return;
    const perm = await VolumeModule.checkPermission();
    setHasPermission(perm);
    const running = await VolumeModule.isServiceRunning();
    setActive(running);
  }, []);

  useEffect(() => {
    syncState();
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        syncState();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [syncState]);

  // Preview Animation
  useEffect(() => {
    previewPulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const previewStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewPulse.value }],
  }));

  const handleToggle = async (val: boolean) => {
    if (!VolumeModule) {
      Alert.alert(
        "Native Module Missing",
        "VolumeModule is not available. Please ensure you are running a 'Development Build' (npx expo run:android) and not using 'Expo Go'.",
        [{ text: "OK" }],
      );
      return;
    }

    try {
      if (val) {
        const perm = await VolumeModule.checkPermission();
        if (!perm) {
          Alert.alert(
            "Permission Required",
            "This app needs 'Draw over other apps' permission to show the floating button. Open settings now?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => VolumeModule.requestPermission(),
              },
            ],
          );
          return;
        }
        await VolumeModule.showFloatingButton(
          color,
          opacity,
          size,
          "left",
          "music",
        );
        setActive(true);
      } else {
        await VolumeModule.hideFloatingButton();
        setActive(false);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to toggle service");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#0F172A", "#1E293B"]}
        style={StyleSheet.absoluteFillObject}
      />

      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.appIcon, { backgroundColor: color }]}>
              <Volume2 color="white" size={28} />
            </View>
            <View>
              <Text style={styles.title}>Volume Master</Text>
              <Text style={styles.subtitle}>Floating Control Overlay</Text>
            </View>
          </View>
        </View>

        {/* Master Switch Card */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.cardLabel}>Enable Service</Text>
              <Text style={styles.cardSub}>Toggle to show/hide the button</Text>
            </View>
            <Switch
              value={active}
              onValueChange={handleToggle}
              trackColor={{ false: "#334155", true: color }}
              thumbColor="white"
            />
          </View>
          {!hasPermission && (
            <TouchableOpacity
              style={styles.permissionWarning}
              onPress={() => VolumeModule?.requestPermission()}
            >
              <VolumeX size={16} color="#F87171" />
              <Text style={styles.warningText}>Overlay Permission Missing</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Live Preview Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewContainer}>
            <View style={styles.previewPhone}>
              <Animated.View
                style={[
                  styles.floatingButtonPreview,
                  previewStyle,
                  {
                    backgroundColor: color,
                    opacity: opacity,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                  },
                ]}
              >
                <Volume2 color="white" size={size * 0.5} />
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Customisation Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customisation</Text>

          <SettingItem
            icon={<Palette size={18} color={color} />}
            label="Button Color"
          >
            <TouchableOpacity
              style={[styles.colorIndicator, { backgroundColor: color }]}
              onPress={() => setShowColorPicker(true)}
            />
          </SettingItem>

          <SettingItem
            icon={<Maximize2 size={18} color="#94A3B8" />}
            label={`Size: ${size}dp`}
          >
            <CustomSlider
              value={size}
              min={40}
              max={100}
              onChange={setSize}
              color={color}
            />
          </SettingItem>

          <SettingItem
            icon={<Volume1 size={18} color="#94A3B8" />}
            label={`Opacity: ${Math.round(opacity * 100)}%`}
          >
            <CustomSlider
              value={opacity * 100}
              min={20}
              max={100}
              onChange={(v) => setOpacity(v / 100)}
              color={color}
            />
          </SettingItem>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Version 1.0.0 | Created with Love
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.colorSheet}>
            <Text style={styles.modalTitle}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c.hex}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.hex },
                    color === c.hex && styles.selectedCircle,
                  ]}
                  onPress={() => {
                    setColor(c.hex);
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 60 },
  splash: { zIndex: 100, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 2 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    elevation: 20,
  },
  logoGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  splashTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "white",
    marginTop: 24,
  },
  splashSub: { fontSize: 14, color: "#94A3B8", marginTop: 6 },
  header: { marginBottom: 30 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "white",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: "#94A3B8", marginTop: 2 },
  card: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: { fontSize: 17, fontWeight: "700", color: "#F1F5F9" },
  cardSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  permissionWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderRadius: 12,
  },
  warningText: { fontSize: 13, color: "#F87171", fontWeight: "600" },
  previewContainer: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  previewPhone: {
    width: "100%",
    height: 120,
    backgroundColor: "#0F172A",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1E293B",
  },
  floatingButtonPreview: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  settingLabelGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { fontSize: 15, color: "#CBD5E1", fontWeight: "600" },
  settingControl: { flex: 1, alignItems: "flex-end" },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 140,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  sliderFill: { height: "100%", borderRadius: 3 },
  sliderBtn: {
    width: 28,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  colorIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  colorSheet: {
    backgroundColor: "#1E293B",
    padding: 24,
    borderRadius: 32,
    width: "85%",
    elevation: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
    marginBottom: 24,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  colorCircle: { width: 44, height: 44, borderRadius: 22 },
  selectedCircle: { borderWidth: 4, borderColor: "white" },
  footer: { alignItems: "center", marginTop: 20 },
  footerText: { fontSize: 12, color: "#334155" },
});
