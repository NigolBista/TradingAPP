// Clean chart styles configuration with proper color literals
// Based on KLineCharts Pro styling options

export const defaultChartStyles = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: "#EDEDED",
      style: "dashed",
      dashedValue: [2, 2],
    },
    vertical: {
      show: true,
      size: 1,
      color: "#EDEDED",
      style: "dashed",
      dashedValue: [2, 2],
    },
  },
  candle: {
    // 'candle_solid' | 'candle_stroke' | 'candle_up_stroke' | 'candle_down_stroke' | 'ohlc' | 'area'
    type: "candle_solid",
    bar: {
      // 'current_open' | 'previous_close'
      compareRule: "current_open",
      upColor: "#2DC08E",
      downColor: "#F92855",
      noChangeColor: "#888888",
      upBorderColor: "#2DC08E",
      downBorderColor: "#F92855",
      noChangeBorderColor: "#888888",
      upWickColor: "#2DC08E",
      downWickColor: "#F92855",
      noChangeWickColor: "#888888",
    },
    area: {
      lineSize: 2,
      lineColor: "#2196F3",
      smooth: false,
      value: "close",
      backgroundColor: [
        {
          offset: 0,
          color: "rgba(33, 150, 243, 0.01)",
        },
        {
          offset: 1,
          color: "rgba(33, 150, 243, 0.2)",
        },
      ],
      point: {
        show: true,
        color: "#2196F3", // Fixed: replaced 'blue' with actual color
        radius: 4,
        rippleColor: "rgba(33, 150, 243, 0.3)", // Fixed: replaced getAlphaBlue(0.3)
        rippleRadius: 8,
        animation: true,
        animationDuration: 1000,
      },
    },
    priceMark: {
      show: true,
      high: {
        show: true,
        color: "#D9D9D9",
        textMargin: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal",
      },
      low: {
        show: true,
        color: "#D9D9D9",
        textMargin: 5,
        textSize: 10,
        textFamily: "Helvetica Neue",
        textWeight: "normal",
      },
      last: {
        show: true,
        // 'current_open' | 'previous_close'
        compareRule: "current_open",
        upColor: "#2DC08E",
        downColor: "#F92855",
        noChangeColor: "#888888",
        line: {
          show: true,
          // 'solid' | 'dashed'
          style: "dashed",
          dashedValue: [4, 4],
          size: 1,
        },
        text: {
          show: true,
          // 'fill' | 'stroke' | 'stroke_fill'
          style: "fill",
          size: 12,
          paddingLeft: 4,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          // 'solid' | 'dashed'
          borderStyle: "solid",
          borderSize: 0,
          borderColor: "transparent",
          borderDashedValue: [2, 2],
          color: "#FFFFFF",
          family: "Helvetica Neue",
          weight: "normal",
          borderRadius: 2,
        },
        extendTexts: [],
      },
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      // 'always' | 'follow_cross' | 'none'
      showRule: "always",
      // 'standard' | 'rect'
      showType: "standard",
      rect: {
        // 'fixed' | 'pointer'
        position: "fixed",
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        offsetLeft: 4,
        offsetTop: 4,
        offsetRight: 4,
        offsetBottom: 4,
        borderRadius: 4,
        borderSize: 1,
        borderColor: "#f2f3f5",
        color: "#FEFEFE",
      },
      title: {
        show: true,
        size: 14,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#888888", // Fixed: replaced Color.GREY
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        template: "{ticker} · {period}",
      },
      legend: {
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#76808F",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        defaultValue: "n/a",
        template: [
          { title: "time", value: "{time}" },
          { title: "open", value: "{open}" },
          { title: "high", value: "{high}" },
          { title: "low", value: "{low}" },
          { title: "close", value: "{close}" },
          { title: "volume", value: "{volume}" },
        ],
      },
      features: [],
    },
  },
  indicator: {
    ohlc: {
      // 'current_open' | 'previous_close'
      compareRule: "current_open",
      upColor: "rgba(45, 192, 142, .7)",
      downColor: "rgba(249, 40, 85, .7)",
      noChangeColor: "#888888",
    },
    bars: [
      {
        // 'fill' | 'stroke' | 'stroke_fill'
        style: "fill",
        // 'solid' | 'dashed'
        borderStyle: "solid",
        borderSize: 1,
        borderDashedValue: [2, 2],
        upColor: "rgba(45, 192, 142, .7)",
        downColor: "rgba(249, 40, 85, .7)",
        noChangeColor: "#888888",
      },
    ],
    lines: [
      {
        // 'solid' | 'dashed'
        style: "solid",
        smooth: false,
        size: 1,
        dashedValue: [2, 2],
        color: "#FF9600",
      },
      {
        style: "solid",
        smooth: false,
        size: 1,
        dashedValue: [2, 2],
        color: "#935EBD",
      },
      {
        style: "solid",
        smooth: false,
        size: 1,
        dashedValue: [2, 2],
        color: "#2196F3",
      },
      {
        style: "solid",
        smooth: false,
        size: 1,
        dashedValue: [2, 2],
        color: "#E11D74",
      },
      {
        style: "solid",
        smooth: false,
        size: 1,
        dashedValue: [2, 2],
        color: "#01C5C4",
      },
    ],
    circles: [
      {
        // 'fill' | 'stroke' | 'stroke_fill'
        style: "fill",
        // 'solid' | 'dashed'
        borderStyle: "solid",
        borderSize: 1,
        borderDashedValue: [2, 2],
        upColor: "rgba(45, 192, 142, .7)",
        downColor: "rgba(249, 40, 85, .7)",
        noChangeColor: "#888888",
      },
    ],
    lastValueMark: {
      show: false,
      text: {
        show: false,
        // 'fill' | 'stroke' | 'stroke_fill'
        style: "fill",
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        // 'solid' | 'dashed'
        borderStyle: "solid",
        borderSize: 1,
        borderDashedValue: [2, 2],
        paddingLeft: 4,
        paddingTop: 4,
        paddingRight: 4,
        paddingBottom: 4,
        borderRadius: 2,
      },
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      // 'always' | 'follow_cross' | 'none'
      showRule: "always",
      // 'standard' | 'rect'
      showType: "standard",
      title: {
        show: true,
        showName: true,
        showParams: true,
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#76808F",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
      },
      legend: {
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        color: "#76808F",
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4,
        defaultValue: "n/a",
      },
      features: [],
    },
  },
  xAxis: {
    show: true,
    size: "auto",
    axisLine: {
      show: true,
      color: "#888888",
      size: 1,
    },
    tickText: {
      show: true,
      color: "#D9D9D9",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4,
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#888888",
    },
  },
  yAxis: {
    show: true,
    size: "auto",
    axisLine: {
      show: true,
      color: "#888888",
      size: 1,
    },
    tickText: {
      show: true,
      color: "#D9D9D9",
      family: "Helvetica Neue",
      weight: "normal",
      size: 12,
      marginStart: 4,
      marginEnd: 4,
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: "#888888",
    },
  },
  separator: {
    size: 1,
    color: "#888888",
    fill: true,
    activeBackgroundColor: "rgba(230, 230, 230, .15)",
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        // 'solid' | 'dashed'
        style: "dashed",
        dashedValue: [4, 2],
        size: 1,
        color: "#888888",
      },
      text: {
        show: true,
        // 'fill' | 'stroke' | 'stroke_fill'
        style: "fill",
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        // 'solid' | 'dashed'
        borderStyle: "solid",
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76",
      },
      features: [],
    },
    vertical: {
      show: true,
      line: {
        show: true,
        // 'solid'|'dashed'
        style: "dashed",
        dashedValue: [4, 2],
        size: 1,
        color: "#888888",
      },
      text: {
        show: true,
        // 'fill' | 'stroke' | 'stroke_fill'
        style: "fill",
        color: "#FFFFFF",
        size: 12,
        family: "Helvetica Neue",
        weight: "normal",
        // 'solid' | 'dashed'
        borderStyle: "solid",
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: "#686D76",
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: "#686D76",
      },
    },
  },
  overlay: {
    point: {
      color: "#1677FF",
      borderColor: "rgba(22, 119, 255, 0.35)",
      borderSize: 1,
      radius: 5,
      activeColor: "#1677FF",
      activeBorderColor: "rgba(22, 119, 255, 0.35)",
      activeBorderSize: 3,
      activeRadius: 5,
    },
    line: {
      // 'solid' | 'dashed'
      style: "solid",
      smooth: false,
      color: "#1677FF",
      size: 1,
      dashedValue: [2, 2],
    },
    rect: {
      // 'fill' | 'stroke' | 'stroke_fill'
      style: "fill",
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1,
      borderRadius: 0,
      // 'solid' | 'dashed'
      borderStyle: "solid",
      borderDashedValue: [2, 2],
    },
    polygon: {
      // 'fill' | 'stroke' | 'stroke_fill'
      style: "fill",
      color: "#1677FF",
      borderColor: "#1677FF",
      borderSize: 1,
      // 'solid' | 'dashed'
      borderStyle: "solid",
      borderDashedValue: [2, 2],
    },
    circle: {
      // 'fill' | 'stroke' | 'stroke_fill'
      style: "fill",
      color: "rgba(22, 119, 255, 0.25)",
      borderColor: "#1677FF",
      borderSize: 1,
      // 'solid' | 'dashed'
      borderStyle: "solid",
      borderDashedValue: [2, 2],
    },
    arc: {
      // 'solid' | 'dashed'
      style: "solid",
      color: "#1677FF",
      size: 1,
      dashedValue: [2, 2],
    },
    text: {
      // 'fill' | 'stroke' | 'stroke_fill'
      style: "fill",
      color: "#FFFFFF",
      size: 12,
      family: "Helvetica Neue",
      weight: "normal",
      // 'solid' | 'dashed'
      borderStyle: "solid",
      borderDashedValue: [2, 2],
      borderSize: 0,
      borderRadius: 2,
      borderColor: "#1677FF",
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      backgroundColor: "#1677FF",
    },
  },
};

// Example usage variations
export const minimalChartStyles = {
  grid: { show: false },
  candle: {
    tooltip: { showRule: "none" },
    priceMark: { show: false },
  },
  xAxis: { show: false },
  yAxis: { show: false },
  crosshair: { show: false },
};

export const tradingChartStyles = {
  grid: {
    show: true,
    horizontal: { show: true, color: "#2a2a2a" },
    vertical: { show: true, color: "#2a2a2a" },
  },
  candle: {
    tooltip: { showRule: "always" },
    priceMark: {
      show: true,
      last: { show: true },
    },
  },
  crosshair: { show: true },
};
