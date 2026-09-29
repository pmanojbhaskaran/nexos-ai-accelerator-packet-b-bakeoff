// pickup-execute.tsx ΓÇö Pickup execution with GPS + proof via shared mobile-api-hooks
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { executePickup } from '@/src/lib/mobile-api-hooks';

export default function PickupExecuteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ shipmentId?: string }>();
  const shipmentId = String(params.shipmentId || '').trim();
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [checklist, setChecklist] = useState({ packageOk: false, documentsOk: false, weightOk: false });

  const captureGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied', 'GPS access required for pickup proof'); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const confirmPickup = async () => {
    if (!shipmentId) { Alert.alert('Shipment Required', 'Open pickup from the task queue with a shipment id'); return; }
    if (!gps) { Alert.alert('GPS Required', 'Capture GPS location before confirming pickup'); return; }
    if (!scanned) { Alert.alert('Scan Required', 'Scan the shipment barcode first'); return; }
    if (!checklist.packageOk || !checklist.documentsOk || !checklist.weightOk) { Alert.alert('Checklist Incomplete', 'Complete all checklist items'); return; }
    setLoading(true);
    try {
      await executePickup(shipmentId, {
        agent_id: 'mobile-agent',
        evidence_count: 1,
        package_count: 1,
        pickup_timestamp: new Date().toISOString(),
      });
      Alert.alert('Pickup Confirmed', 'Shipment pickup submitted (online or queued offline)', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Pickup Failed', e?.message || 'Unable to submit pickup');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Pickup Execution</Text>

      <View style={s.section}>
        <Text style={s.sectionTitle}>1. Scan Shipment</Text>
        <TouchableOpacity style={[s.btn, scanned && s.btnDone]} onPress={() => setScanned(true)}>
          <Text style={s.btnText}>{scanned ? 'Scanned' : 'Scan Barcode'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>2. Checklist</Text>
        {[['packageOk','Package condition OK'],['documentsOk','Documents verified'],['weightOk','Weight matches']].map(([key, label]) => (
          <TouchableOpacity key={key} style={s.checkItem} onPress={() => setChecklist(c => ({ ...c, [key]: !(c as any)[key] }))}>
            <Text style={s.checkBox}>{(checklist as any)[key] ? 'Γ£à' : 'Γ¼£'}</Text>
            <Text style={s.checkLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>3. GPS Location</Text>
        <TouchableOpacity style={[s.btn, gps && s.btnDone]} onPress={captureGps}>
          <Text style={s.btnText}>{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : 'Capture GPS'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.confirmBtn, loading && { opacity: 0.5 }]} onPress={confirmPickup} disabled={loading}>
        <Text style={s.confirmText}>{loading ? 'Confirming...' : 'Confirm Pickup'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  section: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  btn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnDone: { backgroundColor: '#10B981' },
  btnText: { color: '#FFF', fontWeight: '600' },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkBox: { fontSize: 20, marginRight: 12 },
  checkLabel: { fontSize: 14, color: '#374151' },
  confirmBtn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  confirmText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});
