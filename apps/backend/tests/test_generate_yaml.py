from apps.backend.src.orchestrator.slot_mentions import generate_slot_mentions_yaml

def test_generate_yaml():
    print("Generating slot_mentions.yaml from registered flows...")
    generate_slot_mentions_yaml()
    print("YAML generation completed!")