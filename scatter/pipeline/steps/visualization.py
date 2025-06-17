import json
import os

def visualization(config):
    output_dir = config['output_dir']
    build_standalone(config, output_dir)

def build_standalone(config, output_dir):
    print("Building HTML report...")

    with open(f"outputs/{output_dir}/result.json") as f:
        data = json.load(f)

    template_dir = "templates/standalone"

    with open(f"{template_dir}/template.html", 'r', encoding='utf-8') as f:
        template = f.read()
    with open(f"{template_dir}/app.js", 'r', encoding='utf-8') as f:
        app_code = f.read()
    with open(f"{template_dir}/styles.css", 'r', encoding='utf-8') as f:
        styles = f.read()

    simplified_clusters = []
    for i, cluster in enumerate(data['clusters']):
        simplified_args = []
        for j, arg in enumerate(cluster['arguments']):
            simplified_args.append({
                'id': j,  # 短縮されたID
                'argument': arg['argument'],
                'comment_id': arg['comment_id'],
                'x': arg['x'],
                'y': arg['y']
            })
        simplified_clusters.append({
            'cluster': cluster['cluster'],
            'id': i,
            'takeaways': cluster['takeaways'],
            'arguments': simplified_args
        })
    
    simplified_comments = {}
    for comment_id, comment_data in data['comments'].items():
        simplified_comments[comment_id] = {
            'comment': comment_data['comment']
        }
    
    simplified_data = {
        'clusters': simplified_clusters,
        'comments': simplified_comments,
        'overview': data['overview']
    }

    html = template
    html = html.replace("{{title}}", config.get('name', 'レポート'))
    html = html.replace("{{question}}", config.get('question', ''))
    html = html.replace("{{overview}}", data.get('overview', ''))
    html = html.replace("{{data}}", json.dumps(simplified_data, ensure_ascii=False, indent=None, separators=(',', ':')))
    html = html.replace("{{styles}}", styles)
    html = html.replace("{{app_code}}", app_code)

    output_path = f"outputs/{output_dir}/report.html"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    file_size = os.path.getsize(output_path)
    print(f"HTML report generated: {output_path}")
    print(f"File size: {file_size / 1024:.1f} KB")