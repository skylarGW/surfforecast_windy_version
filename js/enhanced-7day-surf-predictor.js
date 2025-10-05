// 🌊 正确格式7天冲浪预测器 - 基于Windy API文档修复
class Enhanced7DaySurfPredictor {
    constructor() {
        this.apiKey = 'gE7AqAGKM8h6TcgHDoseU8HmmddSqQka';
        this.cache = new Map();
        this.cacheTimeout = 30 * 60 * 1000;
        
        this.surfSpots = {
            1: { name: "东沙冲浪公园", lat: 30.0444, lng: 122.1067, calibration: 0.75 },
            2: { name: "岱山鹿栏", lat: 30.2644, lng: 122.2067, calibration: 0.68 },
            3: { name: "石老人海水浴场", lat: 36.1000, lng: 120.4667, calibration: 0.62 },
            4: { name: "流清河海水浴场", lat: 36.0500, lng: 120.3167, calibration: 0.58 },
            5: { name: "黄岛两河口", lat: 35.9667, lng: 120.1833, calibration: 0.52 }
        };
    }

    async get7DayWaveForecast(spotId) {
        const spot = this.surfSpots[spotId];
        if (!spot) throw new Error('无效的浪点ID');

        try {
            // 检测是否在本地环境（没有后端服务器）
            const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            let waveData, weatherData;
            
            if (isLocal) {
                // 本地环境：直接调用Windy API（会因CORS失败）
                throw new Error('CORS限制：本地环境无法直接调用API');
            } else {
                // 服务器环境：使用后端代理
                const waveResponse = await fetch('/api/windy-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lat: spot.lat,
                        lon: spot.lng,
                        model: 'gfsWave',
                        parameters: ['waves', 'swell1', 'swell2', 'windWaves'],
                        levels: ['surface']
                    })
                });

                if (!waveResponse.ok) {
                    throw new Error(`波浪数据API调用失败: ${waveResponse.status}`);
                }

                waveData = await waveResponse.json();
                
                // 获取气象数据
                const weatherResponse = await fetch('/api/windy-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lat: spot.lat,
                        lon: spot.lng,
                        model: 'gfs',
                        parameters: ['wind', 'temp'],
                        levels: ['surface']
                    })
                });

                if (!weatherResponse.ok) {
                    throw new Error(`气象数据API调用失败: ${weatherResponse.status}`);
                }

                weatherData = await weatherResponse.json();
            }
            
            return this.processAndCalibrate7DayData(waveData, weatherData, spot);

        } catch (error) {
            console.error(`获取${spot.name}7天预测失败:`, error);
            throw error;
        }
    }

    processAndCalibrate7DayData(waveData, weatherData, spot) {
        const forecast = {
            spotName: spot.name,
            coordinates: { lat: spot.lat, lng: spot.lng },
            dataSource: 'Windy真实数据',
            generatedAt: new Date().toISOString(),
            days: []
        };

        if (!waveData.ts || !weatherData.ts) {
            throw new Error('API返回数据格式错误');
        }

        // 按天分组数据
        const dailyData = this.groupDataByDay(waveData, weatherData);

        for (const [date, dayData] of Object.entries(dailyData)) {
            const processedDay = this.processDayData(dayData, spot);
            forecast.days.push({
                date: date,
                ...processedDay
            });
        }

        return forecast;
    }

    groupDataByDay(waveData, weatherData) {
        const dailyData = {};
        
        // 处理波浪数据 - 使用正确的响应键名
        for (let i = 0; i < waveData.ts.length; i++) {
            const timestamp = waveData.ts[i];
            const date = new Date(timestamp).toISOString().split('T')[0];
            
            if (!dailyData[date]) {
                dailyData[date] = {
                    timestamps: [],
                    waves: [],
                    swell1: [],
                    swell2: [],
                    windWaves: [],
                    windSpeed: [],
                    windDirection: [],
                    temperature: []
                };
            }

            dailyData[date].timestamps.push(timestamp);
            
            // 使用正确的响应键名
            dailyData[date].waves.push(waveData['waves_height-surface']?.[i] || 0);
            dailyData[date].swell1.push(waveData['swell1_height-surface']?.[i] || 0);
            dailyData[date].swell2.push(waveData['swell2_height-surface']?.[i] || 0);
            dailyData[date].windWaves.push(waveData['wwaves_height-surface']?.[i] || 0);
        }

        // 处理气象数据 - 使用正确的响应键名
        for (let i = 0; i < weatherData.ts.length; i++) {
            const timestamp = weatherData.ts[i];
            const date = new Date(timestamp).toISOString().split('T')[0];
            
            if (dailyData[date]) {
                // wind参数返回wind_u-surface和wind_v-surface
                const windU = weatherData['wind_u-surface']?.[i] || 0;
                const windV = weatherData['wind_v-surface']?.[i] || 0;
                const windSpeed = Math.sqrt(windU * windU + windV * windV) * 1.94384; // 转换为节
                const windDirection = (Math.atan2(windV, windU) * 180 / Math.PI + 180) % 360;
                
                dailyData[date].windSpeed.push(windSpeed);
                dailyData[date].windDirection.push(windDirection);
                dailyData[date].temperature.push((weatherData['temp-surface']?.[i] || 293) - 273.15); // 开尔文转摄氏度
            }
        }

        return dailyData;
    }

    processDayData(dayData, spot) {
        if (dayData.waves.length === 0) {
            return this.getDefaultDayData();
        }

        const calibratedWaves = dayData.waves.map(wave => 
            this.applyFourFactorCalibration(wave, spot)
        );

        const stats = {
            maxWaveHeight: Math.max(...calibratedWaves),
            avgWaveHeight: calibratedWaves.reduce((a, b) => a + b, 0) / calibratedWaves.length,
            minWaveHeight: Math.min(...calibratedWaves),
            maxWindSpeed: dayData.windSpeed.length > 0 ? Math.max(...dayData.windSpeed) : 10,
            avgWindSpeed: dayData.windSpeed.length > 0 ? dayData.windSpeed.reduce((a, b) => a + b, 0) / dayData.windSpeed.length : 10,
            avgTemperature: dayData.temperature.length > 0 ? dayData.temperature.reduce((a, b) => a + b, 0) / dayData.temperature.length : 20
        };

        return {
            statistics: {
                maxWaveHeight: Math.round(stats.maxWaveHeight * 100) / 100,
                avgWaveHeight: Math.round(stats.avgWaveHeight * 100) / 100,
                minWaveHeight: Math.round(stats.minWaveHeight * 100) / 100,
                maxWindSpeed: Math.round(stats.maxWindSpeed * 10) / 10,
                avgWindSpeed: Math.round(stats.avgWindSpeed * 10) / 10,
                avgTemperature: Math.round(stats.avgTemperature * 10) / 10
            },
            recommendation: this.generateSurfRecommendation(stats),
            hourlyData: this.generateHourlyData(dayData, spot),
            dataQuality: 'real'
        };
    }

    getDefaultDayData() {
        return {
            statistics: {
                maxWaveHeight: 0.8,
                avgWaveHeight: 0.6,
                minWaveHeight: 0.4,
                maxWindSpeed: 12.0,
                avgWindSpeed: 10.0,
                avgTemperature: 20.0
            },
            recommendation: {
                score: 50,
                suitability: '一般',
                conditions: ['小浪', '轻风'],
                summary: '一般的冲浪条件'
            },
            hourlyData: [],
            dataQuality: 'fallback'
        };
    }

    applyFourFactorCalibration(waveHeight, spot) {
        const terrainFactor = 0.7;
        const seabedFactor = 0.8;
        const tidalFactor = 0.9;
        const energyFactor = 0.6;
        
        const combinedFactor = terrainFactor * seabedFactor * tidalFactor * energyFactor * spot.calibration;
        
        return Math.max(0.1, waveHeight * combinedFactor);
    }

    generateSurfRecommendation(stats) {
        let score = 0;
        let conditions = [];

        // 浪高评分 (权重5.0)
        if (stats.maxWaveHeight >= 1.5) {
            score += 40;
            conditions.push('大浪');
        } else if (stats.maxWaveHeight >= 1.0) {
            score += 35;
            conditions.push('中浪');
        } else if (stats.maxWaveHeight >= 0.6) {
            score += 25;
            conditions.push('小浪');
        } else {
            score += 10;
            conditions.push('微浪');
        }

        // 风速评分 (权重3.0)
        if (stats.avgWindSpeed <= 10) {
            score += 30;
            conditions.push('轻风');
        } else if (stats.avgWindSpeed <= 15) {
            score += 20;
            conditions.push('中风');
        } else {
            score += 5;
            conditions.push('强风');
        }

        // 水温评分 (权重1.0)
        if (stats.avgTemperature >= 20) {
            score += 20;
            conditions.push('适宜水温');
        } else if (stats.avgTemperature >= 15) {
            score += 15;
            conditions.push('偏凉水温');
        } else {
            score += 5;
            conditions.push('低水温');
        }

        let suitability;
        if (score >= 80) suitability = '优秀';
        else if (score >= 60) suitability = '良好';
        else if (score >= 40) suitability = '一般';
        else suitability = '较差';

        return {
            score: score,
            suitability: suitability,
            conditions: conditions,
            summary: `${suitability}的冲浪条件 (${conditions.join(', ')})`
        };
    }

    generateHourlyData(dayData, spot) {
        const hourlyData = [];
        
        for (let i = 0; i < dayData.timestamps.length; i++) {
            const calibratedWave = this.applyFourFactorCalibration(dayData.waves[i], spot);
            
            hourlyData.push({
                time: new Date(dayData.timestamps[i]).toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                waveHeight: Math.round(calibratedWave * 100) / 100,
                swell1: Math.round((dayData.swell1[i] || 0) * 100) / 100,
                swell2: Math.round((dayData.swell2[i] || 0) * 100) / 100,
                windWaves: Math.round((dayData.windWaves[i] || 0) * 100) / 100,
                windSpeed: Math.round((dayData.windSpeed[i] || 0) * 10) / 10,
                windDirection: Math.round(dayData.windDirection[i] || 0),
                temperature: Math.round((dayData.temperature[i] || 20) * 10) / 10
            });
        }
        
        return hourlyData;
    }
}

window.Enhanced7DaySurfPredictor = Enhanced7DaySurfPredictor;
console.log('🌊 正确格式7天冲浪预测器已加载');