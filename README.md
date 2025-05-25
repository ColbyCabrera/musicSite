# AI Music Generation Tool

This application allows you to generate musical pieces procedurally. You can define various parameters such as key signature, time signature, harmonic complexity, and melodic style to create unique compositions. The generated music can be exported as a MusicXML file for use in other music software.

## Key Features

*   **Customizable Parameters:** Set the key signature, time signature, and number of measures for your composition.
*   **Fine-tune Generation:** Adjust sliders for harmonic complexity, melodic smoothness, and dissonance strictness to influence the musical output.
*   **Multiple Styles:** Choose between different generation styles, including SATB choral harmony and Melody with Accompaniment.
*   **MusicXML Export:** Download your creations as MusicXML files, compatible with most music notation software.

## How to Use

1.  Navigate to the application.
2.  On the music generation interface, you will find controls for various musical parameters.
3.  **Set Parameters:**
    *   Choose a **Key Signature** (e.g., C, Gm, F#).
    *   Select a **Time Signature** (e.g., 4/4, 3/4).
    *   Specify the **Number of Measures**.
    *   Select a **Generation Style** (e.g., SATB, MelodyAccompaniment).
4.  **Adjust Generation Controls (Optional):**
    *   Modify **Harmonic Complexity** to control the richness of chords.
    *   Adjust **Melodic Smoothness** for more or less stepwise melodic motion.
    *   Set **Dissonance Strictness** to control the allowance of clashing notes.
5.  Click the **"Generate Music"** or **"Generate MusicMA"** button.
6.  The generated chord progression will be displayed.
7.  Once generation is complete, a **"Download MusicXML"** button will appear. Click it to save your composition.

## Technology Stack

This project is built with the following core technologies:

*   **Next.js:** A React framework for building server-side rendered and statically generated web applications.
*   **React:** A JavaScript library for building user interfaces.
*   **TypeScript:** A typed superset of JavaScript that compiles to plain JavaScript.
*   **Tailwind CSS:** A utility-first CSS framework for rapid UI development.
*   **Shadcn/UI:** A collection of re-usable UI components.
*   **Tonal.js:** A music theory library for JavaScript.
*   **xmlbuilder2:** A library to create and manipulate XML documents, used for generating MusicXML files.

## Running Locally

To run this project on your local machine, follow these steps:

1.  **Prerequisites:**
    *   Node.js (version 18.17.0 or higher recommended, as per `package.json`). You can use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions.
    *   A package manager like npm, yarn, or pnpm.

2.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

4.  **Set up environment variables (if any):**
    *   This project might require environment variables for certain features (e.g., authentication, API keys). Look for a `.env.example` or similar file, copy it to `.env`, and fill in the necessary values.

5.  **Run the development server:**
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    # pnpm dev
    ```

6.  Open your browser and navigate to `http://localhost:3000` (or the port specified in your terminal).

**Note:** The `seed` script (`npm run seed`) suggests that there might be a database that needs to be seeded. Check `scripts/seed.js` and any related documentation for more details if you need to set up a database.
