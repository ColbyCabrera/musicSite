import { WeightedChoice } from './types';

/**
 * Performs a weighted random choice from a list of items.
 * Each item has an associated weight. Items with higher weights are more likely to be chosen.
 *
 * @template T The type of the items to choose from.
 * @param {WeightedChoice<T>[]} choices - An array of objects, each containing an 'item' and its 'weight'.
 * @returns {T | null} The chosen item, or null if the input array is empty or contains no valid choices.
 */
export const weightedRandomChoice = <T>(choices: WeightedChoice<T>[]): T | null => {
  if (!choices || choices.length === 0) {
    return null; // No choices provided
  }

  const population: T[] = [];
  const weightValues: number[] = [];

  // Populate population and weights, filtering out items with non-positive weights initially
  for (const choice of choices) {
    // Ensure weight is a valid, non-negative number
    const weight =
      typeof choice.weight === 'number' && choice.weight > 0
        ? choice.weight
        : 0;
    population.push(choice.item);
    weightValues.push(weight);
  }

  if (population.length === 0) {
    // This could happen if the original choices array only had items with <= 0 weight
    // Or if the choices array was empty (handled at the start)
    return null;
  }

  let totalWeight = weightValues.reduce((sum, w) => sum + w, 0);

  // If all provided weights were zero or negative, give all original items an equal chance
  if (totalWeight <= 0) {
    // Reset weights to 1 for all *original* valid items if all weights were non-positive
    const numValidOriginalChoices = choices.length; // Use original length here
    if (numValidOriginalChoices === 0) return null; // Still no choices

    // Re-populate based on original choices, giving each weight 1
    population.length = 0; // Clear arrays
    weightValues.length = 0;
    for (const choice of choices) {
      population.push(choice.item);
      weightValues.push(1); // Assign weight 1 to all
    }
    totalWeight = population.length; // Total weight is now the number of items
    if (totalWeight === 0) return null; // Should not happen if choices had length > 0
  }

  let randomWeight = Math.random() * totalWeight;

  for (let i = 0; i < population.length; i++) {
    // Check if the random number falls within the range of the current item's weight
    if (randomWeight < weightValues[i]) {
      return population[i]; // Return the chosen item (which is an array in your case)
    }
    // Subtract the current item's weight to move to the next range
    randomWeight -= weightValues[i];
  }

  // Fallback: This should theoretically not be reached if totalWeight > 0
  // It might be reached if there are floating point precision issues or edge cases.
  // Returning the last item is a reasonable fallback.
  return population.length > 0 ? population[population.length - 1] : null;
};
