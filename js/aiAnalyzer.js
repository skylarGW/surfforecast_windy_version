const aiAnalyzer = {
    generateHourlyTableHTML: function(hourlyData) {
        return `
            <div class="hourly-table">
                <h3>24小时详细预报</h3>
                <table>
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>浪高(m)</th>
                            <th>风速(节)</th>
                            <th>水温(°C)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hourlyData.waveHeight.map((wave, i) => `
                            <tr>
                                <td>${String(i).padStart(2, '0')}:00</td>
                                <td>${wave.toFixed(1)}</td>
                                <td>${(hourlyData.windSpeed[i] || 0).toFixed(1)}</td>
                                <td>${(hourlyData.waterTemp[i] || 20).toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
};