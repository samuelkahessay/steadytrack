#!/usr/bin/env python3
"""
Quick test of LLM resource finder on 3 sample outcomes
"""

import sys
from pathlib import Path

# Add script directory to path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

# Import the module
import llm_resource_finder as finder

# Test with just 3 outcomes
finder.TARGET_OUTCOMES = {
    "bio-30.json": ["30-D1.3k"],  # Hardy-Weinberg principle
    "phys-30.json": ["30-D3.3k"],  # Half-life calculations
    "chem-20.json": ["20-C1.4k"],  # Electrolytes vs nonelectrolytes
}

print("🧪 Testing LLM Resource Finder on 3 sample outcomes:")
print("   • Biology 30: Hardy-Weinberg principle")
print("   • Physics 30: Half-life calculations")
print("   • Chemistry 20: Electrolytes vs nonelectrolytes")
print("")

# Run main
finder.main()
