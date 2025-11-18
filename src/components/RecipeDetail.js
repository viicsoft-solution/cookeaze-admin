import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const RecipeDetail = () => {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const res = await axios.get(
          `https://api.cookeaze.app/api/recipes/${id}/`,
          {
            headers: { accept: "application/json" },
          }
        );
        setRecipe(res.data);
      } catch (err) {
        console.error("Error fetching recipe:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (loading) return <div className="text-center mt-5">Loading recipe...</div>;
  if (!recipe) return <div className="text-center mt-5">Recipe not found.</div>;

  return (
    <div className="container mt-4">
      <div className="card shadow-lg border-0">
        <img
          src={recipe.image_url}
          className="card-img-top"
          alt={recipe.name}
          style={{ maxHeight: "450px", objectFit: "cover" }}
        />
        <div className="card-body">
          <h2 className="card-title mb-3">{recipe.name}</h2>
          <p className="text-muted">{recipe.country}</p>
          <p>{recipe.description}</p>

          <hr />

          <div className="row mb-3">
            <div className="col-md-4">
              <strong>Category:</strong> {recipe.category?.join(", ")}
            </div>
            <div className="col-md-4">
              <strong>Total Time:</strong> {recipe.total_time} mins
            </div>
            <div className="col-md-4">
              <strong>Servings:</strong> {recipe.servings}
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-4">
              <strong>Calories:</strong> {recipe.calories}
            </div>
            <div className="col-md-4">
              <strong>Price:</strong> {recipe.price}
            </div>
            <div className="col-md-4">
              <strong>Exclusive:</strong> {recipe.isExclusive ? "Yes" : "No"}
            </div>
          </div>

          <hr />

          <h5>Ingredients</h5>
          <ul>
            {recipe.ingredients_data?.map((item, i) => (
              <li key={i}>{item.name || JSON.stringify(item)}</li>
            ))}
          </ul>

          <h5>Steps</h5>
          <ol>
            {recipe.steps_data?.map((step, i) => (
              <li key={i}>{step.text || JSON.stringify(step)}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;
