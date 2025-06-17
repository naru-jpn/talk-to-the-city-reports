// グローバル状態管理
const state = {
    selectedCluster: null,
    hoveredPoint: null,
    transform: d3.zoomIdentity
};

// カラーパレット（24色）
const COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2',
    '#c026d3', '#0d9488', '#ea580c', '#4f46e5', '#84cc16', '#f59e0b',
    '#ec4899', '#06b6d4', '#8b5cf6', '#10b981', '#f97316', '#6366f1',
    '#a3e635', '#f43f5e', '#14b8a6', '#a855f7', '#22c55e', '#ef4444'
];

// 初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    try {
        console.log('Initializing app...');
        console.log('D3 version:', d3.version);
        console.log('Report data:', REPORT_DATA);
        
        // データの前処理
        preprocessData();
        
        // 各コンポーネントの初期化
        initScatterPlot();
        initSidebar();
        initEventHandlers();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// データの前処理
function preprocessData() {
    // クラスタに色を割り当て
    REPORT_DATA.clusters.forEach((cluster, index) => {
        cluster.color = COLORS[index % COLORS.length];
        
        // 引数にもクラスタ情報を追加
        cluster.arguments.forEach(arg => {
            arg.cluster = cluster;
            // comment_idを文字列として扱う
            const commentId = String(arg.comment_id);
            const comment = REPORT_DATA.comments[commentId];
            
            if (comment) {
                arg.votes = comment.agrees || 0;
                arg.disagrees = comment.disagrees || 0;
                arg.consensus = arg.votes + arg.disagrees > 0 
                    ? (arg.votes / (arg.votes + arg.disagrees)) * 100 
                    : 0;
            } else {
                console.warn(`Comment not found for ID: ${commentId}`);
                arg.votes = 0;
                arg.disagrees = 0;
                arg.consensus = 0;
            }
        });
    });
}

// 散布図の初期化
function initScatterPlot() {
    try {
        console.log('Initializing scatter plot...');
        
        const container = d3.select('#scatter-wrapper');
        const svg = d3.select('#scatter-plot');
        
        // 要素が存在するか確認
        if (container.empty() || svg.empty()) {
            console.error('Container or SVG element not found');
            return;
        }
        
        // コンテナのサイズを取得
        const containerRect = container.node().getBoundingClientRect();
        const width = containerRect.width || 800;
        const height = (containerRect.height || 600) - 40; // コントロール分を引く
    
    svg.attr('width', width)
       .attr('height', height);
    
    // 座標の範囲を計算
    const allArguments = REPORT_DATA.clusters.flatMap(c => c.arguments);
    console.log('Total arguments:', allArguments.length);
    
    if (allArguments.length === 0) {
        console.error('No arguments found in data');
        return;
    }
    
    const xExtent = d3.extent(allArguments, d => d.x);
    const yExtent = d3.extent(allArguments, d => d.y);
    console.log('X extent:', xExtent, 'Y extent:', yExtent);
    
    // マージンを追加
    const xRange = xExtent[1] - xExtent[0];
    const yRange = yExtent[1] - yExtent[0];
    const margin = 0.1; // 10%のマージン
    
    // スケールの設定
    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xRange * margin, xExtent[1] + xRange * margin])
        .range([50, width - 50]);
    
    const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yRange * margin, yExtent[1] + yRange * margin])
        .range([height - 50, 50]);
    
    // メインのグループを作成
    const g = svg.append('g').attr('class', 'main-group');
    
    // ポイントを描画（最初に描画して背面に配置）
    const pointGroup = g.append('g').attr('class', 'point-group');
    
    // 関数をグローバルに保存（updatePointsの前に実行）
    window.xScale = xScale;
    window.yScale = yScale;
    window.pointGroup = pointGroup;
    window.svg = svg;
    window.g = g;
    
    // ポイントを更新
    updatePoints();
    
    // クラスタラベルを描画（後に描画して前面に配置）
    const labelGroup = g.append('g').attr('class', 'label-group');
    
    REPORT_DATA.clusters.forEach(cluster => {
        // クラスタの中心を計算
        const centerX = d3.mean(cluster.arguments, d => xScale(d.x));
        const centerY = d3.mean(cluster.arguments, d => yScale(d.y));
        
        labelGroup.append('text')
            .attr('class', 'cluster-label')
            .attr('x', centerX)
            .attr('y', centerY)
            .text(cluster.cluster)
            .style('fill', d3.color(cluster.color).darker(1));
    });
    
    // ズーム機能の設定
    const zoom = d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', (event) => {
            state.transform = event.transform;
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    window.zoom = zoom;
    
    console.log('Scatter plot initialized successfully');
    
    } catch (error) {
        console.error('Error initializing scatter plot:', error);
    }
}

// ポイントの更新
function updatePoints() {
    try {
        if (!window.pointGroup) {
            console.error('Point group not initialized');
            return;
        }
        
        const filteredData = getFilteredData();
        console.log('Updating points, filtered data count:', filteredData.length);
        
        // すべての点を再描画（シンプルなアプローチ）
        window.pointGroup.selectAll('.dot').remove();
        window.pointGroup.selectAll('.dot-hitarea').remove();
    
    window.pointGroup.selectAll('.dot')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('data-arg-id', d => `${d.cluster.id}-${d.id}`)  // 一意のIDを付与
        .attr('data-cluster-id', d => d.cluster.id)  // クラスタIDも付与
        .attr('cx', d => window.xScale(d.x))
        .attr('cy', d => window.yScale(d.y))
        .attr('r', 5)
        .style('fill', d => d.cluster.color)
        .style('cursor', 'pointer')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);
    
    // マウス判定範囲を広げるための透明な大きな円を追加
    window.pointGroup.selectAll('.dot-hitarea')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('class', 'dot-hitarea')
        .attr('data-arg-id', d => `${d.cluster.id}-${d.id}`)  // 一意のIDを付与
        .attr('data-cluster-id', d => d.cluster.id)  // クラスタIDも付与
        .attr('cx', d => window.xScale(d.x))
        .attr('cy', d => window.yScale(d.y))
        .attr('r', 12)  // より大きな判定範囲
        .style('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut)
        .on('click', handleClick);
    
    console.log('Points updated:', filteredData.length);
        
    } catch (error) {
        console.error('Error updating points:', error);
    }
}

// ポイントの可視性を更新
function updatePointVisibility() {
    if (!window.pointGroup) return;
    
    if (state.selectedCluster === null) {
        // 全てのクラスタを表示
        window.pointGroup.selectAll('.dot')
            .style('opacity', 1)
            .style('pointer-events', 'all');
        
        window.pointGroup.selectAll('.dot-hitarea')
            .style('pointer-events', 'all');
            
        // ラベルも全て通常表示
        window.g.selectAll('.cluster-label')
            .style('opacity', 1);
    } else {
        // 選択されたクラスタのみ強調表示
        window.pointGroup.selectAll('.dot')
            .style('opacity', function(d) {
                return d.cluster.id === state.selectedCluster ? 1 : 0.2;
            })
            .style('pointer-events', function(d) {
                return d.cluster.id === state.selectedCluster ? 'all' : 'none';
            });
        
        window.pointGroup.selectAll('.dot-hitarea')
            .style('pointer-events', function(d) {
                return d.cluster.id === state.selectedCluster ? 'all' : 'none';
            });
            
        // ラベルも選択されたクラスタのみ強調
        window.g.selectAll('.cluster-label')
            .style('opacity', function(d, i) {
                return REPORT_DATA.clusters[i].id === state.selectedCluster ? 1 : 0.3;
            });
    }
}

// フィルタされたデータを取得
function getFilteredData() {
    return REPORT_DATA.clusters.flatMap(c => c.arguments);
}

// マウスオーバーハンドラ
function handleMouseOver(event, d) {
    // 選択されたクラスタがある場合、そのクラスタ以外はホバー無効
    if (state.selectedCluster !== null && d.cluster.id !== state.selectedCluster) {
        return;
    }
    
    // ツールチップを表示
    const tooltip = d3.select('#tooltip');
    const comment = REPORT_DATA.comments[d.comment_id];
    
    tooltip.select('.tooltip-content')
        .html(`<div>${d.argument}</div>`);
    
    // ツールチップを一時的に表示してサイズを取得
    tooltip.style('display', 'block');
    const tooltipNode = tooltip.node();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // ツールチップの位置を計算（基本はカーソルの右上）
    let left = event.pageX + 2;
    let top = event.pageY - 25;
    
    // 画面右端での調整
    if (left + tooltipRect.width > windowWidth - 10) {
        left = event.pageX - tooltipRect.width - 2;
    }
    
    // 画面上端での調整
    if (top < 10) {
        top = event.pageY + 10;
    }
    
    tooltip
        .style('left', left + 'px')
        .style('top', top + 'px');
    
    // 対応する可視点を見つけて拡大
    const argId = `${d.cluster.id}-${d.id}`;
    window.pointGroup.select(`.dot[data-arg-id="${argId}"]`)
        .transition()
        .duration(150)
        .attr('r', 8);
    
    state.hoveredPoint = d;
}

// マウスアウトハンドラ  
function handleMouseOut(event, d) {
    d3.select('#tooltip').style('display', 'none');
    
    // 同じ位置にある.dot要素を見つけて元のサイズに戻す
    const argId = `${d.cluster.id}-${d.id}`;
    window.pointGroup.select(`.dot[data-arg-id="${argId}"]`)
        .transition()
        .duration(150)
        .attr('r', 5);
    
    state.hoveredPoint = null;
}

// クリックハンドラ
function handleClick(event, d) {
    console.log('Point clicked:', d);
}

// クラスタクリックハンドラ
function handleClusterClick(cluster) {
    // 現在の選択状態を確認
    if (state.selectedCluster === cluster.id) {
        // 同じクラスタをクリックした場合は選択解除
        state.selectedCluster = null;
    } else {
        // 新しいクラスタを選択
        state.selectedCluster = cluster.id;
    }
    
    // サイドバーのクラスタ項目のアクティブ状態を更新
    d3.selectAll('.cluster-item')
        .classed('active', false)
        .style('background-color', '#f9f9f9');
    
    if (state.selectedCluster !== null) {
        d3.select(`.cluster-item[data-cluster-id="${state.selectedCluster}"]`)
            .classed('active', true)
            .style('background-color', '#e7f3ff');
    }
    
    // 散布図のポイントを更新
    updatePointVisibility();
}

// サイドバーの初期化
function initSidebar() {
    const clusterList = d3.select('#cluster-list');
    
    // 「すべて表示」ボタンを追加
    const allButton = clusterList.append('div')
        .attr('class', 'cluster-item show-all')
        .style('margin-bottom', '15px')
        .style('padding', '12px')
        .style('border', '1px solid #d0d0d0')
        .style('border-radius', '6px')
        .style('background-color', '#fafafa')
        .style('cursor', 'pointer')
        .style('text-align', 'center')
        .on('click', function() {
            state.selectedCluster = null;
            d3.selectAll('.cluster-item').classed('active', false).style('background-color', '#f9f9f9');
            d3.select(this).style('background-color', '#fafafa');
            updatePointVisibility();
        });
    
    allButton.append('div')
        .style('font-weight', '500')
        .style('font-size', '13px')
        .style('color', '#666')
        .text('すべて表示');
    
    // 各クラスタの項目を追加
    REPORT_DATA.clusters.forEach((cluster, index) => {
        const clusterDiv = clusterList.append('div')
            .attr('class', 'cluster-item')
            .attr('data-cluster-id', cluster.id)
            .style('margin-bottom', '15px')
            .style('padding', '12px')
            .style('border', '1px solid #e0e0e0')
            .style('border-radius', '6px')
            .style('background-color', '#f9f9f9')
            .style('cursor', 'pointer')
            .on('click', function() {
                handleClusterClick(cluster);
            });
        
        clusterDiv.append('div')
            .attr('class', 'cluster-title')
            .style('font-weight', '600')
            .style('font-size', '14px')
            .style('margin-bottom', '6px')
            .style('color', cluster.color)
            .text(cluster.cluster);
        
        clusterDiv.append('div')
            .attr('class', 'cluster-count')
            .style('font-size', '12px')
            .style('color', '#666')
            .style('margin-bottom', '8px')
            .text(`${cluster.arguments.length}個の意見`);
        
        clusterDiv.append('div')
            .attr('class', 'cluster-takeaway')
            .style('font-size', '12px')
            .style('color', '#666')
            .style('line-height', '1.4')
            .text(cluster.takeaways);
    });
}

// イベントハンドラの初期化
function initEventHandlers() {
    // ズームリセットボタン
    d3.select('#reset-zoom').on('click', () => {
        if (window.svg && window.zoom) {
            window.svg.transition()
                .duration(750)
                .call(window.zoom.transform, d3.zoomIdentity);
        }
    });
    
    // ウィンドウリサイズ処理
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // SVGを再描画
            d3.select('#scatter-plot').selectAll('*').remove();
            initScatterPlot();
        }, 250);
    });
}