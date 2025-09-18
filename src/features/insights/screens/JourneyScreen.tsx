import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUserStore } from "../store/userStore";
import Card from "../components/common/Card";
import Button from "../components/common/Button";

const { width: screenWidth } = Dimensions.get("window");

interface LearningModule {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  completed: boolean;
  progress: number;
  icon: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: "article" | "video" | "quiz" | "simulation";
  duration: string;
  completed: boolean;
  content?: string;
  quiz?: QuizQuestion[];
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  reward: string;
}

interface TradingChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  reward: string;
  timeLimit: string;
  completed: boolean;
}

const learningModules: LearningModule[] = [
  {
    id: "1",
    title: "Trading Fundamentals",
    description:
      "Learn the basics of stock trading, market terminology, and fundamental analysis.",
    difficulty: "Beginner",
    duration: "2 hours",
    completed: false,
    progress: 75,
    icon: "school",
    lessons: [
      {
        id: "1-1",
        title: "What is Stock Trading?",
        type: "article",
        duration: "15 min",
        completed: true,
        content:
          "Stock trading involves buying and selling shares of publicly traded companies...",
      },
      {
        id: "1-2",
        title: "Market Orders vs Limit Orders",
        type: "video",
        duration: "20 min",
        completed: true,
      },
      {
        id: "1-3",
        title: "Understanding Stock Charts",
        type: "article",
        duration: "25 min",
        completed: true,
      },
      {
        id: "1-4",
        title: "Fundamentals Quiz",
        type: "quiz",
        duration: "10 min",
        completed: false,
      },
    ],
  },
  {
    id: "2",
    title: "Technical Analysis",
    description:
      "Master chart patterns, indicators, and technical analysis techniques.",
    difficulty: "Intermediate",
    duration: "3 hours",
    completed: false,
    progress: 30,
    icon: "analytics",
    lessons: [
      {
        id: "2-1",
        title: "Candlestick Patterns",
        type: "video",
        duration: "30 min",
        completed: true,
      },
      {
        id: "2-2",
        title: "Moving Averages",
        type: "article",
        duration: "20 min",
        completed: false,
      },
      {
        id: "2-3",
        title: "RSI and MACD",
        type: "video",
        duration: "25 min",
        completed: false,
      },
      {
        id: "2-4",
        title: "Pattern Recognition",
        type: "simulation",
        duration: "45 min",
        completed: false,
      },
    ],
  },
  {
    id: "3",
    title: "Risk Management",
    description:
      "Learn essential risk management strategies to protect your capital.",
    difficulty: "Intermediate",
    duration: "2.5 hours",
    completed: false,
    progress: 0,
    icon: "shield-checkmark",
    lessons: [
      {
        id: "3-1",
        title: "Position Sizing",
        type: "article",
        duration: "20 min",
        completed: false,
      },
      {
        id: "3-2",
        title: "Stop Losses",
        type: "video",
        duration: "25 min",
        completed: false,
      },
      {
        id: "3-3",
        title: "Portfolio Diversification",
        type: "article",
        duration: "30 min",
        completed: false,
      },
      {
        id: "3-4",
        title: "Risk Assessment Quiz",
        type: "quiz",
        duration: "15 min",
        completed: false,
      },
    ],
  },
  {
    id: "4",
    title: "Advanced Strategies",
    description:
      "Explore sophisticated trading strategies and market psychology.",
    difficulty: "Advanced",
    duration: "4 hours",
    completed: false,
    progress: 0,
    icon: "trending-up",
    lessons: [
      {
        id: "4-1",
        title: "Options Trading Basics",
        type: "video",
        duration: "45 min",
        completed: false,
      },
      {
        id: "4-2",
        title: "Market Psychology",
        type: "article",
        duration: "35 min",
        completed: false,
      },
      {
        id: "4-3",
        title: "Algorithmic Trading",
        type: "video",
        duration: "50 min",
        completed: false,
      },
      {
        id: "4-4",
        title: "Strategy Simulation",
        type: "simulation",
        duration: "60 min",
        completed: false,
      },
    ],
  },
];

const achievements: Achievement[] = [
  {
    id: "first_trade",
    title: "First Steps",
    description: "Complete your first lesson",
    icon: "flag",
    unlocked: true,
    progress: 1,
    maxProgress: 1,
    reward: "50 XP",
  },
  {
    id: "knowledge_seeker",
    title: "Knowledge Seeker",
    description: "Complete 5 lessons",
    icon: "book",
    unlocked: false,
    progress: 3,
    maxProgress: 5,
    reward: "100 XP",
  },
  {
    id: "quiz_master",
    title: "Quiz Master",
    description: "Score 100% on 3 quizzes",
    icon: "trophy",
    unlocked: false,
    progress: 1,
    maxProgress: 3,
    reward: "200 XP",
  },
  {
    id: "streak_champion",
    title: "Streak Champion",
    description: "Complete lessons for 7 days straight",
    icon: "flame",
    unlocked: false,
    progress: 3,
    maxProgress: 7,
    reward: "300 XP",
  },
];

const challenges: TradingChallenge[] = [
  {
    id: "paper_trading",
    title: "Paper Trading Challenge",
    description: "Make 10 profitable paper trades with a 60% win rate",
    difficulty: "Easy",
    reward: "150 XP + Badge",
    timeLimit: "2 weeks",
    completed: false,
  },
  {
    id: "market_analysis",
    title: "Market Analysis Master",
    description: "Correctly predict market direction for 5 consecutive days",
    difficulty: "Medium",
    reward: "250 XP + Exclusive Content",
    timeLimit: "1 week",
    completed: false,
  },
  {
    id: "risk_management",
    title: "Risk Management Pro",
    description: "Complete 20 trades without exceeding 2% account risk",
    difficulty: "Hard",
    reward: "500 XP + Pro Badge",
    timeLimit: "1 month",
    completed: false,
  },
];

export default function JourneyScreen() {
  const { profile, setProfile } = useUserStore();
  const [activeTab, setActiveTab] = useState<
    "learning" | "achievements" | "challenges"
  >("learning");
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(
    null
  );
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[] | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userProgress, setUserProgress] = useState({
    totalXP: 450,
    level: 3,
    streak: 3,
    completedLessons: 6,
    totalLessons: 16,
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
      case "Easy":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Intermediate":
      case "Medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Advanced":
      case "Hard":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "article":
        return "document-text";
      case "video":
        return "play-circle";
      case "quiz":
        return "help-circle";
      case "simulation":
        return "desktop";
      default:
        return "book";
    }
  };

  const completeLesson = (moduleId: string, lessonId: string) => {
    // In a real app, this would update the backend
    Alert.alert("Lesson Complete!", "You earned 25 XP. Keep learning!");
    setShowLessonModal(false);
  };

  const renderLearningModule = (module: LearningModule) => (
    <Card key={module.id} variant="elevated" className="mb-4">
      <Pressable onPress={() => setSelectedModule(module)}>
        <View className="flex-row items-start">
          <View className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg items-center justify-center mr-3">
            <Ionicons name={module.icon as any} size={24} color="#6366f1" />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {module.title}
              </Text>
              <View
                className={`px-2 py-1 rounded-full ${getDifficultyColor(
                  module.difficulty
                )}`}
              >
                <Text className="text-xs font-medium">{module.difficulty}</Text>
              </View>
            </View>
            <Text className="text-gray-700 dark:text-gray-300 mb-3">
              {module.description}
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={14} color="#6b7280" />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {module.duration}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                  {module.progress}%
                </Text>
                <View className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <View
                    className="bg-indigo-600 h-2 rounded-full"
                    style={{ width: `${module.progress}%` }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Card>
  );

  const renderAchievement = (achievement: Achievement) => (
    <Card key={achievement.id} variant="elevated" className="mb-3">
      <View className="flex-row items-center">
        <View
          className={`w-12 h-12 rounded-lg items-center justify-center mr-3 ${
            achievement.unlocked
              ? "bg-yellow-100 dark:bg-yellow-900/30"
              : "bg-gray-100 dark:bg-gray-700"
          }`}
        >
          <Ionicons
            name={achievement.icon as any}
            size={24}
            color={achievement.unlocked ? "#eab308" : "#6b7280"}
          />
        </View>
        <View className="flex-1">
          <Text
            className={`font-semibold ${
              achievement.unlocked
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {achievement.title}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {achievement.description}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                {achievement.progress}/{achievement.maxProgress}
              </Text>
              <View className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <View
                  className="bg-yellow-500 h-1.5 rounded-full"
                  style={{
                    width: `${
                      (achievement.progress / achievement.maxProgress) * 100
                    }%`,
                  }}
                />
              </View>
            </View>
            <Text className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {achievement.reward}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );

  const renderChallenge = (challenge: TradingChallenge) => (
    <Card key={challenge.id} variant="elevated" className="mb-4">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {challenge.title}
            </Text>
            <View
              className={`ml-2 px-2 py-1 rounded-full ${getDifficultyColor(
                challenge.difficulty
              )}`}
            >
              <Text className="text-xs font-medium">
                {challenge.difficulty}
              </Text>
            </View>
          </View>
          <Text className="text-gray-700 dark:text-gray-300 mb-3">
            {challenge.description}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                {challenge.timeLimit}
              </Text>
            </View>
            <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              {challenge.reward}
            </Text>
          </View>
        </View>
      </View>
      <Button
        title={challenge.completed ? "Completed" : "Start Challenge"}
        disabled={challenge.completed}
        size="sm"
        variant={challenge.completed ? "secondary" : "primary"}
        onPress={() =>
          Alert.alert("Challenge", `Starting ${challenge.title}...`)
        }
      />
    </Card>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <LinearGradient
        colors={["#667eea", "#764ba2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 pt-12 pb-6"
      >
        <Text className="text-2xl font-bold text-white mb-2">
          Trader's Journey
        </Text>
        <Text className="text-white/80">
          Master trading skills step by step
        </Text>
      </LinearGradient>

      {/* Progress Overview */}
      <View className="px-4 -mt-4">
        <Card variant="elevated" className="mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                Level {userProgress.level}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {userProgress.totalXP} XP • {userProgress.streak} day streak
              </Text>
            </View>
            <View className="items-end">
              <View className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full items-center justify-center">
                <Text className="text-white font-bold text-lg">
                  {userProgress.level}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              Overall Progress
            </Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-white">
              {userProgress.completedLessons}/{userProgress.totalLessons}{" "}
              lessons
            </Text>
          </View>
          <View className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
            <View
              className="bg-indigo-600 h-2 rounded-full"
              style={{
                width: `${
                  (userProgress.completedLessons / userProgress.totalLessons) *
                  100
                }%`,
              }}
            />
          </View>
        </Card>
      </View>

      {/* Tab Navigation */}
      <View className="px-4">
        <Card variant="elevated">
          <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { key: "learning", label: "Learning" },
              { key: "achievements", label: "Achievements" },
              { key: "challenges", label: "Challenges" },
            ].map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-2 rounded-md ${
                  activeTab === tab.key ? "bg-white dark:bg-gray-600" : ""
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    activeTab === tab.key
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 mt-4"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "learning" && (
          <View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Learning Modules
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {profile?.skillLevel} Level
              </Text>
            </View>
            {learningModules.map(renderLearningModule)}
          </View>
        )}

        {activeTab === "achievements" && (
          <View>
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Your Achievements
            </Text>
            {achievements.map(renderAchievement)}
          </View>
        )}

        {activeTab === "challenges" && (
          <View>
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Trading Challenges
            </Text>
            {challenges.map(renderChallenge)}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Module Detail Modal */}
      <Modal
        visible={selectedModule !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedModule(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedModule?.title}
              </Text>
              <Pressable onPress={() => setSelectedModule(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            {selectedModule && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-gray-700 dark:text-gray-300 mb-4">
                  {selectedModule.description}
                </Text>

                <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Lessons ({selectedModule.lessons.length})
                </Text>

                {selectedModule.lessons.map((lesson, index) => (
                  <Pressable
                    key={lesson.id}
                    onPress={() => {
                      setSelectedLesson(lesson);
                      setShowLessonModal(true);
                    }}
                    className="flex-row items-center py-3 border-b border-gray-200 dark:border-gray-700"
                  >
                    <View className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg items-center justify-center mr-3">
                      <Ionicons
                        name={getLessonIcon(lesson.type) as any}
                        size={16}
                        color="#6366f1"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900 dark:text-white">
                        {lesson.title}
                      </Text>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">
                        {lesson.type} • {lesson.duration}
                      </Text>
                    </View>
                    {lesson.completed && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#16a34a"
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Lesson Modal */}
      <Modal
        visible={showLessonModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLessonModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedLesson?.title}
              </Text>
              <Pressable onPress={() => setShowLessonModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </Pressable>
            </View>

            {selectedLesson && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg items-center justify-center mr-3">
                    <Ionicons
                      name={getLessonIcon(selectedLesson.type) as any}
                      size={20}
                      color="#6366f1"
                    />
                  </View>
                  <View>
                    <Text className="font-medium text-gray-900 dark:text-white capitalize">
                      {selectedLesson.type}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedLesson.duration}
                    </Text>
                  </View>
                </View>

                {selectedLesson.content ? (
                  <View className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                    <Text className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {selectedLesson.content}
                    </Text>
                  </View>
                ) : (
                  <View className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 mb-6 items-center">
                    <Ionicons
                      name="play-circle-outline"
                      size={48}
                      color="#6b7280"
                    />
                    <Text className="text-gray-500 dark:text-gray-400 mt-2 text-center">
                      {selectedLesson.type === "video"
                        ? "Video content would load here"
                        : selectedLesson.type === "quiz"
                        ? "Interactive quiz would load here"
                        : selectedLesson.type === "simulation"
                        ? "Trading simulation would load here"
                        : "Content would load here"}
                    </Text>
                  </View>
                )}

                <Button
                  title={
                    selectedLesson.completed ? "Completed" : "Complete Lesson"
                  }
                  disabled={selectedLesson.completed}
                  onPress={() =>
                    completeLesson(selectedModule?.id || "", selectedLesson.id)
                  }
                  className="mb-4"
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
