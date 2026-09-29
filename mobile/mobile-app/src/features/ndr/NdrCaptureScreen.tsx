import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../lib/theme";
import { ThemedButton } from "../../components/ThemedButton";
import { ThemedCard } from "../../components/ThemedCard";
import { recordNdr } from "../../lib/mobile-api-hooks";

/**
 * NDR Capture (DOC-000061 ┬º7.5)
 * 1. System pre-fills shipment ID + attempt number
 * 2. Operator taps reason from large-button grid (NOT dropdown)
 * 3. Optional notes
 * 4. Submit ΓÇö maximum 3 taps
 */

const NDR_REASONS = [
  { code: "CUST_UNAVAIL", label: "Customer Not Available", icon: "≡ƒæñ" },
  { code: "WRONG_ADDR", label: "Incorrect Address", icon: "≡ƒôì" },
  { code: "REFUSED", label: "Refused Delivery", icon: "≡ƒÜ½" },
  { code: "PREMISES_CLOSED", label: "Premises Closed", icon: "≡ƒÅó" },
  { code: "INCOMPLETE_ADDR", label: "Incomplete Address", icon: "≡ƒô¥" },
  { code: "SECURITY_ISSUE", label: "Security / Access Issue", icon: "≡ƒöÆ" },
  { code: "WEATHER", label: "Weather / Natural Event", icon: "≡ƒîº∩╕Å" },
  { code: "DAMAGE", label: "Package Damaged", icon: "≡ƒôª" },
  { code: "OTHER", label: "Other Reason", icon: "Γ¥ô" },
];

type NdrCaptureParams = {
  shipmentId?: string;
  attemptNumber?: string;
};

export default function NdrCaptureScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<NdrCaptureParams>();
  const routeShipmentId = String(params.shipmentId || "").trim();
  const routeAttemptNumber = Number(params.attemptNumber) || 1;
  const [awb, setAwb] = useState(routeShipmentId);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    const shipmentId = routeShipmentId || awb.trim();
    if (!shipmentId) { Alert.alert("Error", "Please enter shipment AWB"); return; }
    if (!selectedReason) { Alert.alert("Error", "Please select NDR reason"); return; }

    setLoading(true);
    try {
      await recordNdr({
        shipmentId,
        ndrReasonCode: selectedReason,
        attemptNumber: routeAttemptNumber,
        occurredAt: new Date().toISOString(),
        actorId: "mobile-agent",
        agentId: "mobile-agent",
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record NDR";
      Alert.alert("NDR Failed", message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", padding: theme.space.lg }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.successLight,
          justifyContent: "center", alignItems: "center", marginBottom: theme.space.lg }}>
          <Text style={{ fontSize: 36 }}>Γ£ô</Text>
        </View>
        <Text style={{ fontSize: theme.fontSize.lg, fontWeight: "700", color: theme.colors.text }}>NDR Recorded</Text>
        <Text style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.space.xs, textAlign: "center" }}>
          {awb} ΓÇö {NDR_REASONS.find(r => r.code === selectedReason)?.label}
        </Text>
        <ThemedButton label="Record Another" onPress={() => { setAwb(""); setSelectedReason(null); setNotes(""); setDone(false); }}
          variant="primary" style={{ marginTop: theme.space.xl, minWidth: 200 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingHorizontal: theme.space.md, paddingTop: 56, paddingBottom: theme.space.md, backgroundColor: theme.colors.danger }}>
        <Text style={{ fontSize: theme.fontSize.xl, fontWeight: "800", color: "#FFFFFF" }}>Record NDR</Text>
        <Text style={{ fontSize: theme.fontSize.sm, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
          Delivery failed ΓÇö record reason in 3 taps
        </Text>
      </View>

      <ScrollView style={{ flex: 1, padding: theme.space.md }} keyboardShouldPersistTaps="handled">
        {/* Shipment entry */}
        <ThemedCard title="Shipment">
          <ThemedButton label="≡ƒô╖  Scan Barcode" onPress={() => setAwb("AWB900041")} variant="secondary"
            style={{ marginBottom: theme.space.xs }} />
          <TextInput value={awb} onChangeText={setAwb} placeholder="AWB number"
            placeholderTextColor={theme.colors.textTertiary} autoCapitalize="characters"
            style={{
              height: theme.touchTarget, borderWidth: 1, borderColor: theme.colors.border,
              borderRadius: theme.radius.lg, paddingHorizontal: theme.space.md,
              fontSize: theme.fontSize.md, fontWeight: "600",
              backgroundColor: theme.colors.surface, color: theme.colors.text,
              textAlign: "center", letterSpacing: 1,
            }} />
        </ThemedCard>

        {/* Reason grid ΓÇö large buttons, NOT dropdown (DOC-000061 ┬º7.5) */}
        <Text style={{ fontSize: theme.fontSize.md, fontWeight: "700", color: theme.colors.text,
          marginTop: theme.space.md, marginBottom: theme.space.sm }}>
          Select Reason
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs }}>
          {NDR_REASONS.map(reason => {
            const isSelected = selectedReason === reason.code;
            return (
              <TouchableOpacity key={reason.code} onPress={() => setSelectedReason(reason.code)}
                activeOpacity={0.7}
                style={{
                  width: "48%", minHeight: 56,
                  paddingVertical: theme.space.sm, paddingHorizontal: theme.space.md,
                  borderRadius: theme.radius.lg, borderWidth: 2,
                  borderColor: isSelected ? theme.colors.danger : theme.colors.border,
                  backgroundColor: isSelected ? theme.colors.dangerLight : theme.colors.surface,
                  flexDirection: "row", alignItems: "center", gap: theme.space.xs,
                }}>
                <Text style={{ fontSize: 20 }}>{reason.icon}</Text>
                <Text style={{ fontSize: theme.fontSize.sm, fontWeight: isSelected ? "700" : "500",
                  color: isSelected ? theme.colors.danger : theme.colors.text, flex: 1 }}>
                  {reason.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Optional notes */}
        <Text style={{ fontSize: theme.fontSize.sm, fontWeight: "600", color: theme.colors.textSecondary,
          marginTop: theme.space.md, marginBottom: theme.space.xxs }}>
          Notes (optional)
        </Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Additional details..."
          placeholderTextColor={theme.colors.textTertiary} multiline numberOfLines={3}
          style={{
            borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
            paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm,
            fontSize: theme.fontSize.base, backgroundColor: theme.colors.surface,
            color: theme.colors.text, minHeight: 80, textAlignVertical: "top",
          }} />

        {/* Submit */}
        <ThemedButton label="Submit NDR" onPress={handleSubmit} variant="danger" loading={loading}
          disabled={!awb.trim() || !selectedReason}
          style={{ marginTop: theme.space.lg, marginBottom: theme.space.xxl }} />
      </ScrollView>
    </View>
  );
}
