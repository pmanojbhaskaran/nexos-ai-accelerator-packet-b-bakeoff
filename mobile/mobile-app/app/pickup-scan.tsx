import { useEffect, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { fetchFilteredMobileTaskQueueSummary, type MobileTaskQueueSummary } from '@/src/lib/session-bootstrap';

export default function PickupScanScreen() {
  const [queue, setQueue] = useState<MobileTaskQueueSummary | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setErrorCode(null);

      try {
        const summary = await fetchFilteredMobileTaskQueueSummary('PICKUP');

        if (!active) {
          return;
        }

        setQueue(summary);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : 'MOBILE_PICKUP_QUEUE_UNKNOWN_FAILURE';
        setErrorCode(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ThemedView style={styles.heroCard}>
        <ThemedText type="title">Pickup Scan Corridor</ThemedText>
        <ThemedText>
          This corridor now consumes the filtered pickup queue endpoint and opens the real bounded pickup capture workflow instead of stopping at queue visibility.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.heroCard}>
        <ThemedText type="subtitle">Queue Controls</ThemedText>
        <Pressable onPress={() => setRefreshKey((value) => value + 1)} style={styles.primaryButton}>
          <ThemedText style={styles.primaryButtonText}>Refresh Pickup Queue</ThemedText>
        </Pressable>
      </ThemedView>

      {loading ? (
        <ThemedView style={styles.heroCard}>
          <ThemedText>Loading pickup queue...</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && errorCode ? (
        <ThemedView style={styles.heroCard}>
          <ThemedText type="defaultSemiBold">Pickup queue load failed</ThemedText>
          <ThemedText>{errorCode}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorCode && queue ? (
        <ThemedView style={styles.heroCard}>
          <ThemedText type="subtitle">Pickup Queue</ThemedText>
          <ThemedText style={styles.metaLine}>Queue: {queue.queueCode}</ThemedText>
          <ThemedText style={styles.metaLine}>Role: {queue.roleCode}</ThemedText>
          <ThemedText style={styles.metaLine}>Total: {String(queue.totalCount)}</ThemedText>

          {queue.items.length === 0 ? (
            <ThemedView style={styles.emptyStateCard}>
              <ThemedText type="defaultSemiBold">No pickup work right now</ThemedText>
              <ThemedText>The pickup corridor is live but there are no queued pickup tasks for the current mobile session.</ThemedText>
            </ThemedView>
          ) : (
            queue.items.map((item) => (
              <ThemedView key={item.shipmentId + '|' + item.nextActionCode} style={styles.queueCard}>
                <ThemedText type="defaultSemiBold">{item.nextActionLabel}</ThemedText>
                <ThemedText>Shipment: {item.shipmentId}</ThemedText>
                <ThemedText>Current status: {item.currentStatus}</ThemedText>
                {item.waybillNumber ? <ThemedText>Waybill: {item.waybillNumber}</ThemedText> : null}
                {item.branchCode ? <ThemedText>Branch: {item.branchCode}</ThemedText> : null}
                {item.laneCode ? <ThemedText>Lane: {item.laneCode}</ThemedText> : null}

                <Link
                  href={{
                    pathname: '/pickup-scan-execute',
                    params: {
                      shipmentId: item.shipmentId,
                      waybillNumber: item.waybillNumber || '',
                      branchCode: item.branchCode || '',
                      laneCode: item.laneCode || '',
                      nextActionCode: item.nextActionCode,
                      nextActionLabel: item.nextActionLabel,
                    },
                  } as unknown as Href}
                  style={styles.linkButton}
                >
                  Open Pickup Capture
                </Link>
              </ThemedView>
            ))
          )}

          <Link href="/(tabs)" style={styles.linkText}>
            Back to mobile home queue
          </Link>
        </ThemedView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  metaLine: {
    opacity: 0.8,
  },
  emptyStateCard: {
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  queueCard: {
    padding: 12,
    borderRadius: 12,
    gap: 6,
    marginTop: 12,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 6,
    fontWeight: '700',
  },
  linkText: {
    marginTop: 12,
    fontWeight: '600',
  },
});
