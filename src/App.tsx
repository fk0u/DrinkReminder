import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format, startOfWeek, eachDayOfInterval, addDays, isToday } from 'date-fns';
import { Droplets, Volume2, Camera, Check, X, Waves as Wave, Home, Settings, History, Bell, Award, TrendingUp, User } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function App() {
  const [waterConsumed, setWaterConsumed] = useState(0);
  const [lastDrinkTime, setLastDrinkTime] = useState<Date | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'success' | 'failed'>('none');
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [drinkHistory, setDrinkHistory] = useState<{ amount: number; time: Date }[]>([]);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [dailyGoal, setDailyGoal] = useState(parseInt(localStorage.getItem('dailyGoal') || '2000'));
  const [streak, setStreak] = useState(parseInt(localStorage.getItem('streak') || '0'));
  const [weeklyData, setWeeklyData] = useState<number[]>(Array(7).fill(0));
  
  const webcamRef = useRef<Webcam>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Load weekly data
    const startOfCurrentWeek = startOfWeek(new Date());
    const weekDays = eachDayOfInterval({
      start: startOfCurrentWeek,
      end: addDays(startOfCurrentWeek, 6)
    });

    const weeklyConsumption = weekDays.map(day => {
      const dayHistory = drinkHistory.filter(drink => 
        format(drink.time, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );
      return dayHistory.reduce((sum, drink) => sum + drink.amount, 0);
    });

    setWeeklyData(weeklyConsumption);
  }, [drinkHistory]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission === 'granted');
      });
    }

    // Load TensorFlow model and handle splash screen
    const loadModel = async () => {
      await tf.ready();
      const loadedModel = await cocoSsd.load();
      setModel(loadedModel);
      setIsLoading(false);
      setTimeout(() => {
        setShowSplash(false);
      }, 2000);
    };
    loadModel();

    // Set up reminder interval (every 30 minutes)
    const interval = setInterval(() => {
      if (!lastDrinkTime || new Date().getTime() - lastDrinkTime.getTime() > 30 * 60 * 1000) {
        setShowNotification(true);
        if (audioRef.current) {
          audioRef.current.play();
        }
        if (notificationPermission) {
          new Notification('Time to Drink Water!', {
            body: `Hey ${userName || 'there'}! Stay hydrated! Take a water break now.`,
            icon: '/water-icon.png'
          });
        }
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [lastDrinkTime, notificationPermission, userName]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const calculateProgress = () => {
    return Math.min((waterConsumed / dailyGoal) * 100, 100);
  };

  const detectObjects = async () => {
    if (!model || !webcamRef.current) return;

    const video = webcamRef.current.video;
    if (!video) return;

    const predictions = await model.detect(video);
    const hasBottle = predictions.some(pred => 
      ['bottle', 'cup', 'wine glass'].includes(pred.class.toLowerCase())
    );

    if (hasBottle) {
      const amount = 250;
      setWaterConsumed(prev => prev + amount);
      const now = new Date();
      setLastDrinkTime(now);
      setDrinkHistory(prev => [...prev, { amount, time: now }]);
      setVerificationStatus('success');
      setShowNotification(false);

      // Update streak
      const prevDrinkDate = localStorage.getItem('lastDrinkDate');
      const today = format(new Date(), 'yyyy-MM-dd');
      if (prevDrinkDate !== today) {
        const newStreak = isToday(new Date(prevDrinkDate || '')) ? streak + 1 : 1;
        setStreak(newStreak);
        localStorage.setItem('streak', newStreak.toString());
        localStorage.setItem('lastDrinkDate', today);
      }
    } else {
      setVerificationStatus('failed');
    }

    setTimeout(() => {
      setShowCamera(false);
      setVerificationStatus('none');
    }, 2000);
  };

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Water Intake (ml)',
        data: weeklyData,
        fill: true,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <div className="relative">
              <Droplets className="w-24 h-24 text-white" />
              <div className="absolute inset-0 bg-white opacity-20 blur-lg rounded-full animate-pulse"></div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">
            WaterMinder
          </h1>
          {isLoading && (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-100"></div>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-200"></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-8 animate-fade-in">
              <div className="flex items-center">
                <div className="relative">
                  <Droplets className="w-12 h-12 text-blue-500" />
                  <Wave className="w-4 h-4 text-blue-300 absolute -bottom-1 -right-1 animate-pulse" />
                </div>
                <div className="ml-3">
                  <p className="text-gray-600">{getGreeting()}</p>
                  <h1 className="text-2xl font-bold text-gray-800">{userName || 'Friend'}</h1>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Award className="w-6 h-6 text-yellow-500" />
                <span className="font-semibold">{streak} days</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 transform transition-all hover:scale-105">
              <div className="text-center">
                <div className="relative mb-4">
                  <div className="w-32 h-32 mx-auto rounded-full border-8 border-blue-100 flex items-center justify-center">
                    <div className="text-4xl font-bold text-blue-600">
                      {Math.round(calculateProgress())}%
                    </div>
                  </div>
                  <div 
                    className="absolute inset-0 rounded-full border-8 border-blue-500 transition-all duration-1000"
                    style={{
                      clipPath: `polygon(0 0, 100% 0, 100% ${calculateProgress()}%, 0 ${calculateProgress()}%)`
                    }}
                  />
                </div>
                <div className="text-5xl font-bold text-blue-600 mb-2 animate-number">
                  {waterConsumed}
                  <span className="text-2xl ml-1">ml</span>
                </div>
                <p className="text-gray-600">of {dailyGoal}ml daily goal</p>
              </div>
            </div>

            <button
              onClick={() => setShowCamera(true)}
              className="w-full bg-blue-500 text-white py-4 px-6 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95 shadow-lg hover:shadow-xl mb-4"
            >
              <Camera className="w-6 h-6 mr-2" />
              Log Water Intake
            </button>

            {lastDrinkTime && (
              <div className="bg-white rounded-xl p-4 shadow animate-fade-in">
                <p className="text-sm text-gray-500 text-center">
                  Last drink: {lastDrinkTime.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        );
      case 'history':
        return (
          <div className="flex-1 p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Statistics</h2>
            
            <div className="bg-white rounded-xl p-4 shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">Weekly Overview</h3>
              <Line data={chartData} options={chartOptions} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="text-gray-600 text-sm mb-1">Average Daily</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(weeklyData.reduce((a, b) => a + b, 0) / 7)}ml
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="text-gray-600 text-sm mb-1">Best Day</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.max(...weeklyData)}ml
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-4">Today's Log</h3>
            <div className="space-y-4">
              {drinkHistory
                .filter(drink => isToday(drink.time))
                .map((drink, index) => (
                  <div key={index} className="bg-white rounded-xl p-4 shadow-md animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-blue-600">{drink.amount}ml</span>
                      <span className="text-sm text-gray-500">{format(drink.time, 'HH:mm')}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>
            
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-4 shadow-md">
                <label className="block text-gray-700 mb-2">Your Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => {
                    setUserName(e.target.value);
                    localStorage.setItem('userName', e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                />
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md">
                <label className="block text-gray-700 mb-2">Daily Goal (ml)</label>
                <input
                  type="number"
                  value={dailyGoal}
                  onChange={(e) => {
                    setDailyGoal(parseInt(e.target.value));
                    localStorage.setItem('dailyGoal', e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="100"
                  min="500"
                  max="5000"
                />
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-700">Notifications</span>
                  <div className={`w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${notificationPermission ? 'bg-blue-500' : 'bg-gray-300'}`}>
                    <div className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${notificationPermission ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {notificationPermission ? 'Notifications are enabled' : 'Enable notifications to get reminders'}
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <audio ref={audioRef}>
        <source src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" type="audio/mpeg" />
      </audio>

      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {renderContent()}

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto">
          <div className="flex justify-around p-4">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center ${activeTab === 'home' ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">Home</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex flex-col items-center ${activeTab === 'history' ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <TrendingUp className="w-6 h-6" />
              <span className="text-xs mt-1">Stats</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-500'}`}
            >
              <User className="w-6 h-6" />
              <span className="text-xs mt-1">Profile</span>
            </button>
          </div>
        </div>

        {/* Notification Modal */}
        {showNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm transform transition-all animate-slide-up">
              <div className="flex items-center mb-4">
                <Volume2 className="w-8 h-8 text-blue-500 mr-3 animate-pulse" />
                <h2 className="text-2xl font-semibold">Time to drink water!</h2>
              </div>
              <p className="text-gray-600 mb-6 text-lg">
                Hey {userName || 'there'}! Stay hydrated! It's been a while since your last drink.
              </p>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => {
                    setShowCamera(true);
                    setShowNotification(false);
                  }}
                  className="w-full py-4 bg-blue-500 text-white rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all active:scale-95"
                >
                  Take Photo
                </button>
                <button
                  onClick={() => setShowNotification(false)}
                  className="w-full py-4 text-gray-600 hover:text-gray-800 text-lg font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 bg-black flex flex-col animate-fade-in">
            <div className="flex-1 relative">
              <Webcam
                ref={webcamRef}
                className="w-full h-full object-cover"
                screenshotFormat="image/jpeg"
              />
              {verificationStatus === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50 animate-fade-in">
                  <Check className="w-24 h-24 text-white animate-scale-in" />
                </div>
              )}
              {verificationStatus === 'failed' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-50 animate-fade-in">
                  <X className="w-24 h-24 text-white animate-scale-in" />
                </div>
              )}
            </div>
            <div className="bg-black bg-opacity-75 p-6 space-y-3">
              <button
                onClick={detectObjects}
                className="w-full py-4 bg-blue-500 text-white rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all active:scale-95"
              >
                Verify Drink
              </button>
              <button
                onClick={() => setShowCamera(false)}
                className="w-full py-4 text-white text-lg font-semibold opacity-75 hover:opacity-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;