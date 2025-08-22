import React, { useRef, useState, useCallback } from "react";
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
  PinchGestureHandlerGestureEvent,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
} from "react-native-reanimated";

interface ChartTouchHandlerProps {
  children: React.ReactNode;
  width: number;
  height: number;
  onPan?: (deltaX: number, deltaY: number) => void;
  onZoom?: (scale: number, focalX: number, focalY: number) => void;
  onPanEnd?: () => void;
  onZoomEnd?: () => void;
  enablePan?: boolean;
  enableZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
  style?: any;
}

export default function ChartTouchHandler({
  children,
  width,
  height,
  onPan,
  onZoom,
  onPanEnd,
  onZoomEnd,
  enablePan = true,
  enableZoom = true,
  minZoom = 0.5,
  maxZoom = 5,
  style,
}: ChartTouchHandlerProps) {
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);

  // Animated values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Pan gesture handler
  const panGestureHandler =
    useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: () => {
        // Reset any ongoing animations
      },
      onActive: (event) => {
        if (!enablePan) return;

        translateX.value = event.translationX;
        translateY.value = event.translationY;

        // Call onPan callback
        if (onPan) {
          runOnJS(onPan)(event.translationX, event.translationY);
        }
      },
      onEnd: (event) => {
        if (!enablePan) return;

        // Spring back to original position or handle momentum
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);

        if (onPanEnd) {
          runOnJS(onPanEnd)();
        }
      },
    });

  // Pinch gesture handler
  const pinchGestureHandler =
    useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
      onStart: (event) => {
        focalX.value = event.focalX;
        focalY.value = event.focalY;
      },
      onActive: (event) => {
        if (!enableZoom) return;

        // Constrain scale within limits
        const newScale = Math.max(minZoom, Math.min(maxZoom, event.scale));
        scale.value = newScale;

        // Update focal point
        focalX.value = event.focalX;
        focalY.value = event.focalY;

        // Call onZoom callback
        if (onZoom) {
          runOnJS(onZoom)(newScale, event.focalX, event.focalY);
        }
      },
      onEnd: () => {
        if (!enableZoom) return;

        // Spring back to 1x zoom or handle final scale
        scale.value = withSpring(1);

        if (onZoomEnd) {
          runOnJS(onZoomEnd)();
        }
      },
    });

  // Animated style for the container
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <GestureHandlerRootView
      style={[styles.container, { width, height }, style]}
    >
      <PinchGestureHandler
        ref={pinchRef}
        onGestureEvent={pinchGestureHandler}
        enabled={enableZoom}
        simultaneousHandlers={panRef}
      >
        <Animated.View style={styles.gestureContainer}>
          <PanGestureHandler
            ref={panRef}
            onGestureEvent={panGestureHandler}
            enabled={enablePan}
            simultaneousHandlers={pinchRef}
            minPointers={1}
            maxPointers={1}
          >
            <Animated.View style={[styles.chartContainer, animatedStyle]}>
              {children}
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  gestureContainer: {
    flex: 1,
  },
  chartContainer: {
    flex: 1,
  },
});
