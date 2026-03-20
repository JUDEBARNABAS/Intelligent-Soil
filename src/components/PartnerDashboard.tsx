import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NGODashboardData, SoilData, Farmer } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  Users, Database, TrendingUp, MapPin, ArrowLeft, 
  Download, Filter, Calendar, Loader2, Globe, ExternalLink,
  Layers, Map as MapIcon, RefreshCw, AlertTriangle, CheckCircle,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useAdvancedMarkerRef,
  useMap
} from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface PartnerDashboardProps {
  onBack: () => void;
  onOpenKnowledgeBase: () => void;
}

const MapOverlay = ({ layers }: { layers: any[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({ layers });
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [map, layers]);
  return null;
};

const FarmerMarker = ({ farmer, onClick }: { farmer: Farmer & { latestTest: SoilData | null }, onClick: () => void }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const fertility = farmer.latestTest?.fertility || 0;
  const color = fertility >= 70 ? '#10b981' : fertility >= 40 ? '#f59e0b' : '#ef4444';

  if (!farmer.latestTest?.location) return null;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: farmer.latestTest.location.latitude, lng: farmer.latestTest.location.longitude }}
      onClick={onClick}
    >
      <Pin background={color} glyphColor="#fff" borderColor="#fff" />
    </AdvancedMarker>
  );
};

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({ onBack, onOpenKnowledgeBase }) => {
  const [data, setData] = useState<NGODashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'critical' | 'no-data'>('all');
  const [mapMode, setMapMode] = useState<'markers' | 'ph' | 'fertility'>('markers');
  const [selectedFarmer, setSelectedFarmer] = useState<(Farmer & { latestTest: SoilData | null }) | null>(null);
  const [viewingFarmerDetails, setViewingFarmerDetails] = useState<(Farmer & { latestTest: SoilData | null }) | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/partner/dashboard');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please ensure you are logged in and have partner access.');
        }
        throw new Error(`Failed to fetch dashboard data (Status: ${response.status})`);
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSoilStatus = (fertility: number) => {
    if (fertility >= 70) return 'healthy';
    if (fertility >= 40) return 'warning';
    return 'critical';
  };

  const filteredFarmers = data?.farmers.filter(farmer => {
    const matchesSearch = 
      farmer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      farmer.farmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (farmer.farmLocation || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = farmer.latestTest ? getSoilStatus(farmer.latestTest.fertility) : 'no-data';
    const matchesFilter = filterStatus === 'all' || status === filterStatus;

    return matchesSearch && matchesFilter;
  }) || [];

  const stats = {
    healthy: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'healthy').length || 0,
    warning: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'warning').length || 0,
    critical: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'critical').length || 0,
    noData: data?.farmers.filter(f => !f.latestTest).length || 0,
    avgPh: data?.recentTests.length ? (data.recentTests.reduce((acc, t) => acc + t.ph, 0) / data.recentTests.length).toFixed(1) : '0.0',
    avgN: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.nitrogen, 0) / data.recentTests.length) : 0,
    avgP: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.phosphorus, 0) / data.recentTests.length) : 0,
    avgK: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.potassium, 0) / data.recentTests.length) : 0,
    soilHealthDistribution: [
      { name: 'Healthy', value: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'healthy').length || 0, color: '#10b981' },
      { name: 'Warning', value: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'warning').length || 0, color: '#f59e0b' },
      { name: 'Critical', value: data?.farmers.filter(f => f.latestTest && getSoilStatus(f.latestTest.fertility) === 'critical').length || 0, color: '#ef4444' },
      { name: 'No Data', value: data?.farmers.filter(f => !f.latestTest).length || 0, color: '#9ca3af' },
    ],
    nutrientBalance: [
      { subject: 'Nitrogen', A: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.nitrogen, 0) / data.recentTests.length) : 0, fullMark: 100 },
      { subject: 'Phosphorus', A: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.phosphorus, 0) / data.recentTests.length) : 0, fullMark: 100 },
      { subject: 'Potassium', A: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.potassium, 0) / data.recentTests.length) : 0, fullMark: 100 },
      { subject: 'Conductivity', A: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + (t.conductivity / 10), 0) / data.recentTests.length) : 0, fullMark: 100 },
      { subject: 'Humidity', A: data?.recentTests.length ? Math.round(data.recentTests.reduce((acc, t) => acc + t.humidity, 0) / data.recentTests.length) : 0, fullMark: 100 },
    ]
  };

  const regionalData = data?.farmers.reduce((acc: any[], f) => {
    const region = (f.farmLocation || 'Unknown').split(',')[0].trim();
    const existing = acc.find(a => a.region === region);
    if (existing) {
      existing.count++;
      if (f.latestTest) {
        existing.totalFertility += f.latestTest.fertility;
        existing.testCount++;
      }
    } else {
      acc.push({ 
        region, 
        count: 1, 
        totalFertility: f.latestTest ? f.latestTest.fertility : 0,
        testCount: f.latestTest ? 1 : 0
      });
    }
    return acc;
  }, []).map(r => ({
    ...r,
    avgFertility: r.testCount > 0 ? Math.round(r.totalFertility / r.testCount) : 0
  })) || [];

  const heatmapData = data?.recentTests
    .filter(t => t.location)
    .map(t => ({
      position: [t.location!.longitude, t.location!.latitude],
      weight: mapMode === 'ph' ? t.ph : t.fertility
    })) || [];

  const layers = [
    new HeatmapLayer({
      id: 'soil-heatmap',
      data: heatmapData,
      getPosition: (d: any) => d.position,
      getWeight: (d: any) => d.weight,
      radiusPixels: 60,
      intensity: 1,
      threshold: 0.05,
      colorRange: mapMode === 'ph' 
        ? [[255, 0, 0], [255, 255, 0], [0, 255, 0]] // Red to Green for pH
        : [[255, 255, 0], [0, 255, 0], [0, 128, 0]] // Yellow to Dark Green for Fertility
    })
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const fertilityData = data?.recentTests.map(t => ({
    name: format(t.timestamp, 'MMM d'),
    fertility: t.fertility
  })).reverse() || [];

  const phDistribution = data?.recentTests.reduce((acc: any[], t) => {
    const range = Math.floor(t.ph);
    const existing = acc.find(a => a.range === range);
    if (existing) existing.count++;
    else acc.push({ range, count: 1, name: `pH ${range}-${range+1}` });
    return acc;
  }, []) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">Loading Partner Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Agriculture Partner Dashboard</h1>
              <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold">Soil and weather intelligence Network</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={fetchData}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onOpenKnowledgeBase}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              <Database size={14} />
              <span>Knowledge Base</span>
            </button>
            <button className="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <div className="h-6 w-px bg-gray-200 mx-2" />
            <div className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Live Data</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4"
          >
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Total Farmers</p>
              <p className="text-3xl font-bold text-gray-900">{data?.totalFarmers}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4"
          >
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <Database size={24} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Healthy Soils</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.healthy}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4"
          >
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Warning Soils</p>
              <p className="text-3xl font-bold text-amber-600">{stats.warning}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
              <Filter size={24} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Critical Soils</p>
              <p className="text-3xl font-bold text-red-600">{stats.critical}</p>
            </div>
          </motion.div>
        </div>

        {/* Analysis Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Avg. pH Level</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-2xl font-bold text-gray-900">{stats.avgPh}</p>
              <span className="text-[10px] text-gray-500">Optimal: 6.0-7.5</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Avg. Nitrogen (N)</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.avgN} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Avg. Phosphorus (P)</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.avgP} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Avg. Potassium (K)</p>
            <p className="text-2xl font-bold text-amber-600">{stats.avgK} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
          </div>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-[500px] relative">
          {!hasValidKey ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-8 text-center">
              <div className="max-w-md space-y-4">
                <AlertTriangle className="mx-auto text-amber-500" size={48} />
                <h3 className="text-lg font-bold">Google Maps Key Required</h3>
                <p className="text-sm text-gray-500">
                  To view the pH and Fertility maps, please add your <code>GOOGLE_MAPS_PLATFORM_KEY</code> to the app secrets.
                </p>
              </div>
            </div>
          ) : (
            <APIProvider apiKey={API_KEY}>
              <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
                <button 
                  onClick={() => setMapMode('markers')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-md transition-all ${
                    mapMode === 'markers' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <MapPin size={12} />
                    <span>Farmer Locations</span>
                  </div>
                </button>
                <button 
                  onClick={() => setMapMode('ph')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-md transition-all ${
                    mapMode === 'ph' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Layers size={12} />
                    <span>pH Heatmap</span>
                  </div>
                </button>
                <button 
                  onClick={() => setMapMode('fertility')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-md transition-all ${
                    mapMode === 'fertility' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <TrendingUp size={12} />
                    <span>Fertility Heatmap</span>
                  </div>
                </button>
              </div>

              <Map
                defaultCenter={{ lat: 0.3476, lng: 32.5825 }} // Central Uganda
                defaultZoom={8}
                mapId="PARTNER_PORTAL_MAP"
                {...({ internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'] } as any)}
                style={{ width: '100%', height: '100%' }}
              >
                {mapMode === 'markers' ? (
                  data?.farmers.map(farmer => (
                    <FarmerMarker 
                      key={farmer.id} 
                      farmer={farmer} 
                      onClick={() => setSelectedFarmer(farmer)} 
                    />
                  ))
                ) : (
                  <MapOverlay layers={layers} />
                )}

                {mapMode === 'markers' && data?.farmers.filter(f => f.latestTest?.location).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 pointer-events-none">
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center max-w-xs pointer-events-auto">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <MapIcon size={24} />
                      </div>
                      <h4 className="font-bold text-gray-900 mb-1">No Locations Available</h4>
                      <p className="text-xs text-gray-500">
                        None of the registered farmers have soil test data with GPS coordinates yet.
                      </p>
                    </div>
                  </div>
                )}

                {selectedFarmer && selectedFarmer.latestTest?.location && (
                  <InfoWindow 
                    position={{ 
                      lat: selectedFarmer.latestTest.location.latitude, 
                      lng: selectedFarmer.latestTest.location.longitude 
                    }}
                    onCloseClick={() => setSelectedFarmer(null)}
                  >
                    <div className="p-2 min-w-[200px] space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                          {selectedFarmer.name.charAt(0)}
                        </div>
                        <h4 className="font-bold text-sm">{selectedFarmer.name}</h4>
                      </div>
                      <p className="text-[10px] text-gray-500">{selectedFarmer.farmName}</p>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-[8px] text-gray-400 uppercase font-bold">Fertility</p>
                          <p className="text-xs font-bold text-emerald-600">{selectedFarmer.latestTest.fertility}%</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-gray-400 uppercase font-bold">pH Level</p>
                          <p className="text-xs font-bold text-indigo-600">{selectedFarmer.latestTest.ph}</p>
                        </div>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Soil Health Distribution</h2>
              <PieChartIcon size={16} className="text-gray-300" />
            </div>
            <div className="h-[300px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.soilHealthDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.soilHealthDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col space-y-2 ml-4">
                {stats.soilHealthDistribution.map((entry, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Average Nutrient Balance</h2>
              <TrendingUp size={16} className="text-gray-300" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.nutrientBalance}>
                  <PolarGrid stroke="#f0f0f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                  <Radar
                    name="Average"
                    dataKey="A"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Soil Fertility Trends</h2>
              <Globe size={16} className="text-gray-300" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fertilityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="fertility" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Regional Soil Health</h2>
              <Globe size={16} className="text-gray-300" />
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionalData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="region" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} width={100} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="avgFertility" fill="#10b981" radius={[0, 8, 8, 0]} name="Avg. Fertility %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Farmer Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Farmer Profiles Directory</h2>
              <p className="text-[10px] text-gray-400 mt-1">Showing {filteredFarmers.length} of {data?.totalFarmers} farmers</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search farmers..." 
                  className="pl-8 pr-4 py-1.5 bg-gray-50 rounded-full border-none text-xs focus:ring-2 focus:ring-indigo-500 w-48"
                />
                <Users size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-gray-50 border-none rounded-full px-4 py-1.5 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="healthy">Healthy</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="no-data">No Data</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farmer Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Farm Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Soil Status</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Latest Test</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFarmers.map(farmer => {
                  const latestTest = farmer.latestTest;
                  const status = latestTest ? getSoilStatus(latestTest.fertility) : 'no-data';
                  
                  return (
                    <tr key={farmer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            status === 'healthy' ? 'bg-emerald-100 text-emerald-600' :
                            status === 'warning' ? 'bg-amber-100 text-amber-600' :
                            status === 'critical' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            {farmer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{farmer.name}</p>
                            <p className="text-[10px] text-gray-400">{farmer.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{farmer.farmName}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1 text-gray-500">
                          <MapPin size={12} />
                          <span className="text-xs">{farmer.farmLocation || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          status === 'healthy' ? 'bg-emerald-50 text-emerald-600' :
                          status === 'warning' ? 'bg-amber-50 text-amber-600' :
                          status === 'critical' ? 'bg-red-50 text-red-600' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {latestTest ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold">{latestTest.fertility}% Fertility</span>
                            </div>
                            <p className="text-[10px] text-gray-400">{format(latestTest.timestamp, 'MMM d, yyyy')}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No tests yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setViewingFarmerDetails(farmer)}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <ExternalLink size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredFarmers.length === 0 && (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Farmers Found</h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">
                {data?.totalFarmers === 0 
                  ? "There are currently no farmers registered in the system. Farmers must be added via the main dashboard."
                  : "No farmers match your current search or filter criteria."}
              </p>
              {data?.totalFarmers === 0 && (
                <div className="flex flex-col space-y-3 items-center">
                  <button 
                    onClick={onBack}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all w-full max-w-[200px]"
                  >
                    Go to Main Dashboard
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm("This will add 5 sample farmers and soil tests for demonstration. Continue?")) {
                        try {
                          setIsLoading(true);
                          const { collection, addDoc } = await import('firebase/firestore');
                          const { db, auth } = await import('../firebase');
                          if (!auth.currentUser) throw new Error("Must be logged in");
                          
                          const sampleFarmers = [
                            { name: "John Okello", farmName: "Okello Organic Farm", phone: "+256 700 000001", email: "john@example.com", farmLocation: "Gulu" },
                            { name: "Sarah Namubiru", farmName: "Namubiru Green Acres", phone: "+256 700 000002", email: "sarah@example.com", farmLocation: "Kampala" },
                            { name: "David Musoke", farmName: "Musoke Coffee Estate", phone: "+256 700 000003", email: "david@example.com", farmLocation: "Masaka" },
                            { name: "Grace Akello", farmName: "Akello Maize Farm", phone: "+256 700 000004", email: "grace@example.com", farmLocation: "Lira" },
                            { name: "Peter Mukasa", farmName: "Mukasa Dairy Farm", phone: "+256 700 000005", email: "peter@example.com", farmLocation: "Mbarara" }
                          ];

                          for (const f of sampleFarmers) {
                            const farmerRef = await addDoc(collection(db, 'farmers'), {
                              ...f,
                              uid: auth.currentUser.uid,
                              createdAt: Date.now()
                            });

                            // Add a soil test for each farmer
                            await addDoc(collection(db, 'soil_tests'), {
                              farmerId: farmerRef.id,
                              farmerName: f.name,
                              uid: auth.currentUser.uid,
                              timestamp: Date.now(),
                              ph: 5.5 + Math.random() * 2,
                              nitrogen: 20 + Math.random() * 80,
                              phosphorus: 10 + Math.random() * 40,
                              potassium: 100 + Math.random() * 200,
                              temperature: 22 + Math.random() * 10,
                              humidity: 40 + Math.random() * 40,
                              conductivity: 0.5 + Math.random() * 1.5,
                              fertility: 40 + Math.random() * 50,
                              location: {
                                latitude: 0.3476 + (Math.random() - 0.5) * 2,
                                longitude: 32.5825 + (Math.random() - 0.5) * 2
                              }
                            });
                          }
                          alert("Sample data added successfully!");
                          fetchData();
                        } catch (err: any) {
                          alert("Error adding sample data: " + err.message);
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                    className="px-6 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-all w-full max-w-[200px]"
                  >
                    Seed Sample Data
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {viewingFarmerDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-xl">
                    {viewingFarmerDetails.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{viewingFarmerDetails.name}</h2>
                    <p className="text-xs text-indigo-100 uppercase tracking-widest font-bold">{viewingFarmerDetails.farmName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingFarmerDetails(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Phone</p>
                    <p className="text-sm font-bold text-gray-900">{viewingFarmerDetails.phone || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Location</p>
                    <p className="text-sm font-bold text-gray-900">{viewingFarmerDetails.farmLocation || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Joined</p>
                    <p className="text-sm font-bold text-gray-900">{format(viewingFarmerDetails.createdAt, 'MMM yyyy')}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Soil Status</p>
                    <p className={`text-sm font-bold uppercase ${
                      getSoilStatus(viewingFarmerDetails.latestTest?.fertility || 0) === 'healthy' ? 'text-emerald-600' :
                      getSoilStatus(viewingFarmerDetails.latestTest?.fertility || 0) === 'warning' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {viewingFarmerDetails.latestTest ? getSoilStatus(viewingFarmerDetails.latestTest.fertility) : 'No Data'}
                    </p>
                  </div>
                </div>

                {viewingFarmerDetails.latestTest ? (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-2">Latest Soil Analysis</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Fertility Score</p>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                viewingFarmerDetails.latestTest.fertility > 70 ? 'bg-emerald-500' :
                                viewingFarmerDetails.latestTest.fertility > 40 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${viewingFarmerDetails.latestTest.fertility}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold">{viewingFarmerDetails.latestTest.fertility}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">pH Level</p>
                        <p className="text-xl font-bold text-indigo-600">{viewingFarmerDetails.latestTest.ph}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Nitrogen (N)</p>
                        <p className="text-xl font-bold text-gray-900">{viewingFarmerDetails.latestTest.nitrogen} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Phosphorus (P)</p>
                        <p className="text-xl font-bold text-gray-900">{viewingFarmerDetails.latestTest.phosphorus} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Potassium (K)</p>
                        <p className="text-xl font-bold text-gray-900">{viewingFarmerDetails.latestTest.potassium} <span className="text-xs font-normal text-gray-400">mg/kg</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Conductivity</p>
                        <p className="text-xl font-bold text-gray-900">{viewingFarmerDetails.latestTest.conductivity} <span className="text-xs font-normal text-gray-400">µS/cm</span></p>
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-2">
                      <div className="flex items-center space-x-2 text-indigo-600">
                        <TrendingUp size={18} />
                        <h4 className="font-bold text-sm uppercase tracking-widest">AI Soil Analysis</h4>
                      </div>
                      <p className="text-sm text-indigo-900 leading-relaxed">
                        Based on the latest readings from {format(viewingFarmerDetails.latestTest.timestamp, 'MMMM d, yyyy')}, 
                        this farm shows {viewingFarmerDetails.latestTest.fertility > 70 ? 'excellent' : viewingFarmerDetails.latestTest.fertility > 40 ? 'moderate' : 'low'} fertility levels. 
                        The pH of {viewingFarmerDetails.latestTest.ph} is {viewingFarmerDetails.latestTest.ph < 6 ? 'slightly acidic' : viewingFarmerDetails.latestTest.ph > 7.5 ? 'slightly alkaline' : 'optimal'} for most local crops.
                        {viewingFarmerDetails.latestTest.nitrogen < 30 ? ' Nitrogen supplementation is recommended.' : ''}
                        {viewingFarmerDetails.latestTest.phosphorus < 20 ? ' Phosphorus levels are below target.' : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <Database className="mx-auto text-gray-200" size={48} />
                    <p className="text-gray-400">No soil test data available for this farmer yet.</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => setViewingFarmerDetails(null)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Globe size={16} />
            </div>
            <span className="text-xs font-bold text-gray-900 uppercase tracking-widest">Intelligent Soil Partner Portal</span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">
            © 2026 Soil and weather intelligence. All rights reserved. Data shared under Partner partnership agreement.
          </p>
        </div>
      </footer>
    </div>
  );
};
