"use client";

import React from "react";

export default function Page() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "20px",
          padding: "30px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        }}
      >
        <a
          href="/population"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "14px 28px",
            background: "#4f46e5",
            color: "#fff",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: "600",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Population
        </a>

        <a
          href="/crime"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: "14px 28px",
            background: "#ef4444",
            color: "#fff",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: "600",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Crime
        </a>
      </div>
    </div>
  );
}