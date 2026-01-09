"""Entry point for Ron Strands Agent."""

from core.agent import create_agent


def main():
    """Run Ron Agent in interactive CLI mode."""
    agent = create_agent()

    print("Ron Agent initialized. Type 'exit' to quit.")
    while True:
        user_input = input("\nYou: ")
        if user_input.lower() in ["exit", "quit"]:
            break
        result = agent(user_input)
        print(f"\nRon: {result}")


if __name__ == "__main__":
    main()
